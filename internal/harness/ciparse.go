package harness

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// ParseCI scans a repo root for CI configs (GitHub Actions, Makefile, package.json)
// and extracts build/test/lint/typecheck/setup commands. Returns zero-value Commands
// if nothing is found. GitHub Actions takes priority, then Makefile, then package.json.
func ParseCI(root string) Commands {
	if cmds := parseGitHubActions(root); cmds != (Commands{}) {
		return cmds
	}
	if cmds := parseMakefile(root); cmds != (Commands{}) {
		return cmds
	}
	return parsePackageJSON(root)
}

// --- GitHub Actions ---

// ghWorkflow is a minimal representation of a GitHub Actions workflow file.
type ghWorkflow struct {
	Jobs map[string]ghJob `yaml:"jobs"`
}

type ghJob struct {
	Steps []ghStep `yaml:"steps"`
}

type ghStep struct {
	Name string `yaml:"name"`
	Run  string `yaml:"run"`
}

func parseGitHubActions(root string) Commands {
	dir := filepath.Join(root, ".github", "workflows")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return Commands{}
	}

	var cmds Commands
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext != ".yml" && ext != ".yaml" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var wf ghWorkflow
		if err := yaml.Unmarshal(data, &wf); err != nil {
			continue
		}
		for _, job := range wf.Jobs {
			for _, step := range job.Steps {
				classifyGHStep(&cmds, step)
			}
		}
	}
	return cmds
}

// classifyGHStep categorizes a GitHub Actions run step as build/test/lint/typecheck/setup.
func classifyGHStep(cmds *Commands, step ghStep) {
	run := strings.TrimSpace(step.Run)
	if run == "" {
		return
	}
	name := strings.ToLower(step.Name)

	// Extract the meaningful command from multi-line run blocks.
	cmd := extractCommand(run)
	if cmd == "" {
		return
	}

	// Skip setup/install/infrastructure commands for classification.
	if isSetupCommand(cmd) {
		if cmds.Setup == "" {
			cmds.Setup = cmd
		}
		return
	}

	switch {
	case cmds.Build == "" && matchesCategory(name, cmd, buildPatterns):
		cmds.Build = cmd
	case cmds.Test == "" && matchesCategory(name, cmd, testPatterns):
		cmds.Test = cmd
	case cmds.Lint == "" && matchesCategory(name, cmd, lintPatterns):
		cmds.Lint = cmd
	case cmds.Typecheck == "" && matchesCategory(name, cmd, typecheckPatterns):
		cmds.Typecheck = cmd
	}
}

var (
	buildPatterns     = []string{"build"}
	testPatterns      = []string{"test"}
	lintPatterns      = []string{"lint", "golangci-lint", "eslint", "clippy"}
	typecheckPatterns = []string{"typecheck", "type-check", "tsc", "mypy", "pyright"}
	setupKeywords     = []string{"install", "setup", "apt-get", "brew ", "curl ", "pip install", "go install"}
)

func matchesCategory(stepName, cmd string, patterns []string) bool {
	lower := strings.ToLower(cmd)
	for _, p := range patterns {
		if strings.Contains(stepName, p) || strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

func isSetupCommand(cmd string) bool {
	lower := strings.ToLower(cmd)
	for _, kw := range setupKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

// extractCommand pulls the primary command from a (possibly multi-line) run block.
// It skips set -o, echo, if/then, and env-setting lines, returning the first
// substantive command.
var skipLineRe = regexp.MustCompile(`^(set\s|echo\s|#|if\s|then|fi|else|export\s|cd\s)`)

func extractCommand(run string) string {
	for _, line := range strings.Split(run, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || skipLineRe.MatchString(line) {
			continue
		}
		// Strip trailing pipe to tee, etc.
		if idx := strings.Index(line, " 2>&1"); idx > 0 {
			line = strings.TrimSpace(line[:idx])
		}
		if idx := strings.Index(line, " | tee "); idx > 0 {
			line = strings.TrimSpace(line[:idx])
		}
		return line
	}
	return ""
}

// --- Makefile ---

// parseMakefile reads a Makefile and extracts commands from known targets.
func parseMakefile(root string) Commands {
	data, err := os.ReadFile(filepath.Join(root, "Makefile"))
	if err != nil {
		return Commands{}
	}
	targets := parseMakeTargets(string(data))
	var cmds Commands
	if v, ok := targets["build"]; ok {
		cmds.Build = v
	}
	if v, ok := targets["test"]; ok {
		cmds.Test = v
	}
	if v, ok := targets["lint"]; ok {
		cmds.Lint = v
	}
	if v, ok := targets["typecheck"]; ok {
		cmds.Typecheck = v
	} else if v, ok := targets["check"]; ok && cmds.Typecheck == "" {
		cmds.Typecheck = v
	}
	return cmds
}

// parseMakeTargets extracts target→first-recipe-line from Makefile content.
// Only captures simple targets (no prerequisites parsing needed).
var makeTargetRe = regexp.MustCompile(`^([a-zA-Z_][a-zA-Z0-9_-]*):\s*`)

func parseMakeTargets(content string) map[string]string {
	targets := make(map[string]string)
	lines := strings.Split(content, "\n")
	var currentTarget string
	for _, line := range lines {
		if m := makeTargetRe.FindStringSubmatch(line); m != nil {
			currentTarget = m[1]
			continue
		}
		if currentTarget != "" && strings.HasPrefix(line, "\t") {
			cmd := strings.TrimSpace(line)
			// Strip leading @ (silent prefix).
			cmd = strings.TrimPrefix(cmd, "@")
			cmd = strings.TrimSpace(cmd)
			// Skip empty, comments, echo, conditionals.
			if cmd == "" || strings.HasPrefix(cmd, "#") || strings.HasPrefix(cmd, "echo ") {
				continue
			}
			targets[currentTarget] = cmd
			currentTarget = "" // only first substantive line
		} else if !strings.HasPrefix(line, "\t") && !strings.HasPrefix(line, " ") {
			currentTarget = ""
		}
	}
	return targets
}

// --- package.json ---

type packageJSON struct {
	Scripts map[string]string `json:"scripts"`
}

func parsePackageJSON(root string) Commands {
	data, err := os.ReadFile(filepath.Join(root, "package.json"))
	if err != nil {
		return Commands{}
	}
	var pkg packageJSON
	if err := json.Unmarshal(data, &pkg); err != nil {
		return Commands{}
	}
	if len(pkg.Scripts) == 0 {
		return Commands{}
	}

	// Detect package manager for run prefix.
	runner := "npm"
	if fileExists(root, "pnpm-lock.yaml") {
		runner = "pnpm"
	} else if fileExists(root, "yarn.lock") {
		runner = "yarn"
	}

	var cmds Commands
	if _, ok := pkg.Scripts["build"]; ok {
		cmds.Build = runner + " run build"
	}
	if _, ok := pkg.Scripts["test"]; ok {
		cmds.Test = runner + " test"
	}
	if _, ok := pkg.Scripts["lint"]; ok {
		cmds.Lint = runner + " run lint"
	}
	if _, ok := pkg.Scripts["typecheck"]; ok {
		cmds.Typecheck = runner + " run typecheck"
	}
	if _, ok := pkg.Scripts["setup"]; ok {
		cmds.Setup = runner + " run setup"
	} else {
		cmds.Setup = runner + " install"
	}
	return cmds
}
