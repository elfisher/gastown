package bootstrap

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/steveyegge/gastown/internal/harness"
)

func TestGenerateAgentsMD_NewFile(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "README.md")
	touch(t, dir, ".eslintrc.json")
	touch(t, dir, ".prettierrc")
	touch(t, dir, "jest.config.ts")
	mkdir(t, dir, "__tests__")

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}
	cmds := harness.Commands{
		Build: "npm run build",
		Test:  "npm test",
		Lint:  "npm run lint",
	}

	result, err := GenerateAgentsMD(dir, m, cmds, GenerateOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.AgentsMDAction != "created" {
		t.Errorf("action = %q, want created", result.AgentsMDAction)
	}

	content, err := os.ReadFile(filepath.Join(dir, "AGENTS.md"))
	if err != nil {
		t.Fatal(err)
	}
	s := string(content)

	// Check key sections exist.
	for _, want := range []string{
		"# Agent Instructions",
		"## Discovered",
		"[README](README.md)",
		".eslintrc.json",
		".prettierrc",
		"Jest",
		"`npm run build` (tier0)",
		"`npm test` (tier0)",
		"`npm run lint` (tier1)",
	} {
		if !strings.Contains(s, want) {
			t.Errorf("AGENTS.md missing %q", want)
		}
	}
}

func TestGenerateAgentsMD_PreservesManualContent(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "README.md")

	// Write existing AGENTS.md with manual content.
	manual := "# Agent Instructions\n\nCustom manual content here.\n\nDo not delete this.\n"
	if err := os.WriteFile(filepath.Join(dir, "AGENTS.md"), []byte(manual), 0644); err != nil {
		t.Fatal(err)
	}

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}
	cmds := harness.Commands{Build: "make build"}

	result, err := GenerateAgentsMD(dir, m, cmds, GenerateOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.AgentsMDAction != "updated" {
		t.Errorf("action = %q, want updated", result.AgentsMDAction)
	}

	content, err := os.ReadFile(filepath.Join(dir, "AGENTS.md"))
	if err != nil {
		t.Fatal(err)
	}
	s := string(content)

	if !strings.Contains(s, "Custom manual content here.") {
		t.Error("manual content was overwritten")
	}
	if !strings.Contains(s, "## Discovered") {
		t.Error("missing Discovered section")
	}
}

func TestGenerateAgentsMD_ReplacesDiscoveredSection(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "README.md")

	existing := "# Agent Instructions\n\nManual.\n\n## Discovered\n\nOld auto content.\n"
	if err := os.WriteFile(filepath.Join(dir, "AGENTS.md"), []byte(existing), 0644); err != nil {
		t.Fatal(err)
	}

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}
	cmds := harness.Commands{Build: "go build ./..."}

	result, err := GenerateAgentsMD(dir, m, cmds, GenerateOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.AgentsMDAction != "updated" {
		t.Errorf("action = %q, want updated", result.AgentsMDAction)
	}

	content, err := os.ReadFile(filepath.Join(dir, "AGENTS.md"))
	if err != nil {
		t.Fatal(err)
	}
	s := string(content)

	if strings.Contains(s, "Old auto content") {
		t.Error("old Discovered section was not replaced")
	}
	if !strings.Contains(s, "Manual.") {
		t.Error("manual content was lost")
	}
	if !strings.Contains(s, "`go build ./...`") {
		t.Error("new commands not present")
	}
}

func TestGenerateAgentsMD_DryRun(t *testing.T) {
	dir := t.TempDir()
	m := &Manifest{Root: dir}
	cmds := harness.Commands{Build: "make"}

	result, err := GenerateAgentsMD(dir, m, cmds, GenerateOptions{DryRun: true})
	if err != nil {
		t.Fatal(err)
	}
	if result.AgentsMDAction != "created" {
		t.Errorf("action = %q, want created", result.AgentsMDAction)
	}
	// File should NOT exist.
	if _, err := os.Stat(filepath.Join(dir, "AGENTS.md")); err == nil {
		t.Error("AGENTS.md was written in dry-run mode")
	}
}

func TestGenerateCodebaseMap_NewFile(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "go.mod")
	mkdir(t, dir, "cmd", "gt")
	touch(t, dir, "cmd/gt/main.go")
	mkdir(t, dir, "internal")
	touch(t, dir, "internal/foo.go")
	touch(t, dir, "internal/bar.go")
	mkdir(t, dir, "docs")
	touch(t, dir, "docs/readme.md")

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}

	result, err := GenerateCodebaseMap(dir, m, GenerateOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.CodebaseMapAction != "created" {
		t.Errorf("action = %q, want created", result.CodebaseMapAction)
	}

	content, err := os.ReadFile(filepath.Join(dir, "CODEBASE_MAP.md"))
	if err != nil {
		t.Fatal(err)
	}
	s := string(content)

	for _, want := range []string{
		"# Codebase Map",
		"## Structure",
		"cmd/",
		"internal/",
		"docs/",
		"## Entry Points",
		"cmd/gt/main.go",
	} {
		if !strings.Contains(s, want) {
			t.Errorf("CODEBASE_MAP.md missing %q", want)
		}
	}
}

func TestGenerateCodebaseMap_SkipsIfArchitectureExists(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "ARCHITECTURE.md")
	mkdir(t, dir, "src")

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}

	result, err := GenerateCodebaseMap(dir, m, GenerateOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.CodebaseMapAction != "skipped" {
		t.Errorf("action = %q, want skipped (architecture doc exists)", result.CodebaseMapAction)
	}
}

func TestGenerateCodebaseMap_SkipsIfAlreadyExists(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "CODEBASE_MAP.md")
	mkdir(t, dir, "src")

	m := &Manifest{Root: dir}

	result, err := GenerateCodebaseMap(dir, m, GenerateOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.CodebaseMapAction != "skipped" {
		t.Errorf("action = %q, want skipped (file exists)", result.CodebaseMapAction)
	}
}

func TestGenerateCodebaseMap_ReadsDependencies(t *testing.T) {
	dir := t.TempDir()
	gomod := `module example.com/myapp

go 1.23

require (
	github.com/spf13/cobra v1.8.0
	gopkg.in/yaml.v3 v3.0.1
)
`
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(gomod), 0644); err != nil {
		t.Fatal(err)
	}
	mkdir(t, dir, "internal")

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}

	result, err := GenerateCodebaseMap(dir, m, GenerateOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.CodebaseMapAction != "created" {
		t.Errorf("action = %q, want created", result.CodebaseMapAction)
	}

	content, err := os.ReadFile(filepath.Join(dir, "CODEBASE_MAP.md"))
	if err != nil {
		t.Fatal(err)
	}
	s := string(content)

	if !strings.Contains(s, "## Dependencies") {
		t.Error("missing Dependencies section")
	}
	if !strings.Contains(s, "cobra") {
		t.Error("missing cobra dependency")
	}
}

func TestMergeDiscoveredSection_Append(t *testing.T) {
	existing := "# Agent Instructions\n\nManual content.\n"
	section := "## Discovered\n\nNew stuff.\n"

	result := mergeDiscoveredSection(existing, section)
	if !strings.Contains(result, "Manual content.") {
		t.Error("lost manual content")
	}
	if !strings.Contains(result, "New stuff.") {
		t.Error("missing new section")
	}
}

func TestMergeDiscoveredSection_Replace(t *testing.T) {
	existing := "# Agent Instructions\n\nManual.\n\n## Discovered\n\nOld.\n"
	section := "## Discovered\n\nNew.\n"

	result := mergeDiscoveredSection(existing, section)
	if strings.Contains(result, "Old.") {
		t.Error("old section not replaced")
	}
	if !strings.Contains(result, "New.") {
		t.Error("new section missing")
	}
	if !strings.Contains(result, "Manual.") {
		t.Error("manual content lost")
	}
}
