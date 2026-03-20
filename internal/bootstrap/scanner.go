// Package bootstrap provides repo scanning and discovery for gt rig bootstrap.
package bootstrap

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// ArtifactType classifies a discovered artifact.
type ArtifactType string

const (
	TypeDoc        ArtifactType = "doc"
	TypeLintConfig ArtifactType = "lint_config"
	TypeFmtConfig  ArtifactType = "format_config"
	TypeTestDir    ArtifactType = "test_dir"
	TypeTestConfig ArtifactType = "test_config"
	TypeEditorCfg  ArtifactType = "editor_config"
	TypeCIConfig   ArtifactType = "ci_config"
	TypeBuildFile  ArtifactType = "build_file"
	TypeTSConfig   ArtifactType = "typescript_config"
	TypeAgentDoc   ArtifactType = "agent_doc"
)

// Artifact is a single discovered repo artifact.
type Artifact struct {
	Path string       `json:"path"`
	Type ArtifactType `json:"type"`
	Name string       `json:"name"`
	// Detail holds optional extra info (e.g. framework name, CI provider).
	Detail string `json:"detail,omitempty"`
}

// Manifest is the output of a repo scan.
type Manifest struct {
	Root      string     `json:"root"`
	Artifacts []Artifact `json:"artifacts"`
}

// JSON serializes the manifest.
func (m *Manifest) JSON() ([]byte, error) {
	return json.MarshalIndent(m, "", "  ")
}

// ScanRepo scans root and returns a discovery manifest.
func ScanRepo(root string) (*Manifest, error) {
	m := &Manifest{Root: root}

	scanDocs(root, m)
	scanLintConfigs(root, m)
	scanFormatConfigs(root, m)
	scanEditorConfig(root, m)
	scanBuildFiles(root, m)
	scanTSConfig(root, m)
	scanCIConfigs(root, m)
	scanTestConfigs(root, m)
	scanTestDirs(root, m)
	scanAgentDocs(root, m)

	return m, nil
}

// --- doc scanning ---

var docFiles = []struct {
	glob   string
	name   string
	detail string
}{
	{"README.md", "README", "project overview"},
	{"README.rst", "README", "project overview"},
	{"CONTRIBUTING.md", "CONTRIBUTING", "coding standards"},
	{"CONTRIBUTING.rst", "CONTRIBUTING", "coding standards"},
	{"ARCHITECTURE.md", "ARCHITECTURE", "codebase structure"},
	{"docs/architecture.md", "ARCHITECTURE", "codebase structure"},
	{"docs/ARCHITECTURE.md", "ARCHITECTURE", "codebase structure"},
	{"CHANGELOG.md", "CHANGELOG", "release history"},
	{"SECURITY.md", "SECURITY", "security policy"},
}

func scanDocs(root string, m *Manifest) {
	for _, d := range docFiles {
		if exists(root, d.glob) {
			m.Artifacts = append(m.Artifacts, Artifact{
				Path: d.glob, Type: TypeDoc, Name: d.name, Detail: d.detail,
			})
		}
	}
}

// --- lint config scanning ---

var lintConfigs = []struct {
	glob   string
	name   string
	detail string
}{
	{".eslintrc", "eslint", "ESLint"},
	{".eslintrc.js", "eslint", "ESLint"},
	{".eslintrc.cjs", "eslint", "ESLint"},
	{".eslintrc.json", "eslint", "ESLint"},
	{".eslintrc.yml", "eslint", "ESLint"},
	{".eslintrc.yaml", "eslint", "ESLint"},
	{"eslint.config.js", "eslint", "ESLint (flat config)"},
	{"eslint.config.mjs", "eslint", "ESLint (flat config)"},
	{"eslint.config.cjs", "eslint", "ESLint (flat config)"},
	{"eslint.config.ts", "eslint", "ESLint (flat config)"},
	{".golangci.yml", "golangci-lint", "golangci-lint"},
	{".golangci.yaml", "golangci-lint", "golangci-lint"},
	{"clippy.toml", "clippy", "Rust Clippy"},
	{".clippy.toml", "clippy", "Rust Clippy"},
	{".pylintrc", "pylint", "Pylint"},
	{"setup.cfg", "flake8", "Flake8 (via setup.cfg)"},
	{".flake8", "flake8", "Flake8"},
	{"ruff.toml", "ruff", "Ruff"},
	{".ruff.toml", "ruff", "Ruff"},
}

func scanLintConfigs(root string, m *Manifest) {
	for _, c := range lintConfigs {
		if exists(root, c.glob) {
			m.Artifacts = append(m.Artifacts, Artifact{
				Path: c.glob, Type: TypeLintConfig, Name: c.name, Detail: c.detail,
			})
		}
	}
}

// --- format config scanning ---

var fmtConfigs = []struct {
	glob   string
	name   string
	detail string
}{
	{".prettierrc", "prettier", "Prettier"},
	{".prettierrc.js", "prettier", "Prettier"},
	{".prettierrc.cjs", "prettier", "Prettier"},
	{".prettierrc.json", "prettier", "Prettier"},
	{".prettierrc.yml", "prettier", "Prettier"},
	{".prettierrc.yaml", "prettier", "Prettier"},
	{".prettierrc.toml", "prettier", "Prettier"},
	{"prettier.config.js", "prettier", "Prettier"},
	{"prettier.config.cjs", "prettier", "Prettier"},
	{"rustfmt.toml", "rustfmt", "Rust fmt"},
	{".rustfmt.toml", "rustfmt", "Rust fmt"},
	{"gofmt.toml", "gofmt", "Go fmt"},
	{".clang-format", "clang-format", "clang-format"},
	{"pyproject.toml", "black/ruff", "Python formatter (pyproject.toml)"},
}

func scanFormatConfigs(root string, m *Manifest) {
	for _, c := range fmtConfigs {
		if exists(root, c.glob) {
			m.Artifacts = append(m.Artifacts, Artifact{
				Path: c.glob, Type: TypeFmtConfig, Name: c.name, Detail: c.detail,
			})
		}
	}
}

// --- editor config ---

func scanEditorConfig(root string, m *Manifest) {
	if exists(root, ".editorconfig") {
		m.Artifacts = append(m.Artifacts, Artifact{
			Path: ".editorconfig", Type: TypeEditorCfg, Name: "editorconfig", Detail: "indentation, line endings",
		})
	}
}

// --- build files ---

var buildFiles = []struct {
	glob   string
	name   string
	detail string
}{
	{"go.mod", "go.mod", "Go"},
	{"package.json", "package.json", "Node/TypeScript"},
	{"Cargo.toml", "Cargo.toml", "Rust"},
	{"Makefile", "Makefile", "Make"},
	{"pyproject.toml", "pyproject.toml", "Python"},
	{"setup.py", "setup.py", "Python (legacy)"},
	{"build.gradle", "build.gradle", "Gradle"},
	{"build.gradle.kts", "build.gradle.kts", "Gradle (Kotlin DSL)"},
	{"pom.xml", "pom.xml", "Maven"},
	{"CMakeLists.txt", "CMakeLists.txt", "CMake"},
}

func scanBuildFiles(root string, m *Manifest) {
	for _, b := range buildFiles {
		if exists(root, b.glob) {
			m.Artifacts = append(m.Artifacts, Artifact{
				Path: b.glob, Type: TypeBuildFile, Name: b.name, Detail: b.detail,
			})
		}
	}
}

// --- typescript config ---

func scanTSConfig(root string, m *Manifest) {
	if exists(root, "tsconfig.json") {
		m.Artifacts = append(m.Artifacts, Artifact{
			Path: "tsconfig.json", Type: TypeTSConfig, Name: "tsconfig", Detail: "TypeScript compiler config",
		})
	}
}

// --- CI config scanning ---

func scanCIConfigs(root string, m *Manifest) {
	// GitHub Actions
	wfDir := filepath.Join(root, ".github", "workflows")
	entries, err := os.ReadDir(wfDir)
	if err == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			name := e.Name()
			if strings.HasSuffix(name, ".yml") || strings.HasSuffix(name, ".yaml") {
				m.Artifacts = append(m.Artifacts, Artifact{
					Path:   filepath.Join(".github", "workflows", name),
					Type:   TypeCIConfig,
					Name:   strings.TrimSuffix(strings.TrimSuffix(name, ".yml"), ".yaml"),
					Detail: "GitHub Actions",
				})
			}
		}
	}

	// Other CI systems
	ciFiles := []struct {
		path   string
		name   string
		detail string
	}{
		{".circleci/config.yml", "circleci", "CircleCI"},
		{".travis.yml", "travis", "Travis CI"},
		{"Jenkinsfile", "jenkins", "Jenkins"},
		{".gitlab-ci.yml", "gitlab-ci", "GitLab CI"},
		{"azure-pipelines.yml", "azure-pipelines", "Azure Pipelines"},
		{"bitbucket-pipelines.yml", "bitbucket-pipelines", "Bitbucket Pipelines"},
	}
	for _, c := range ciFiles {
		if exists(root, c.path) {
			m.Artifacts = append(m.Artifacts, Artifact{
				Path: c.path, Type: TypeCIConfig, Name: c.name, Detail: c.detail,
			})
		}
	}
}

// --- test config scanning ---

var testConfigs = []struct {
	glob   string
	name   string
	detail string
}{
	{"jest.config.js", "jest", "Jest"},
	{"jest.config.ts", "jest", "Jest"},
	{"jest.config.cjs", "jest", "Jest"},
	{"jest.config.mjs", "jest", "Jest"},
	{"jest.config.json", "jest", "Jest"},
	{"vitest.config.ts", "vitest", "Vitest"},
	{"vitest.config.js", "vitest", "Vitest"},
	{"vitest.config.mts", "vitest", "Vitest"},
	{"pytest.ini", "pytest", "pytest"},
	{".pytest.ini", "pytest", "pytest"},
	{"conftest.py", "pytest", "pytest (conftest)"},
}

func scanTestConfigs(root string, m *Manifest) {
	for _, c := range testConfigs {
		if exists(root, c.glob) {
			m.Artifacts = append(m.Artifacts, Artifact{
				Path: c.glob, Type: TypeTestConfig, Name: c.name, Detail: c.detail,
			})
		}
	}
}

// --- test directory scanning ---

var testDirNames = []string{
	"test", "tests", "__tests__", "spec", "specs",
	"test_data", "testdata", "fixtures",
}

func scanTestDirs(root string, m *Manifest) {
	for _, d := range testDirNames {
		info, err := os.Stat(filepath.Join(root, d))
		if err == nil && info.IsDir() {
			m.Artifacts = append(m.Artifacts, Artifact{
				Path: d, Type: TypeTestDir, Name: d, Detail: "test directory",
			})
		}
	}

	// Go convention: *_test.go files alongside source (detect presence)
	if exists(root, "go.mod") {
		if hasGoTestFiles(root) {
			m.Artifacts = append(m.Artifacts, Artifact{
				Path: ".", Type: TypeTestDir, Name: "go-inline-tests", Detail: "Go *_test.go files (inline)",
			})
		}
	}
}

func hasGoTestFiles(root string) bool {
	found := false
	// Walk only top-level and one level deep to keep it fast.
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		// Skip deep directories and hidden/vendor dirs.
		rel, _ := filepath.Rel(root, path)
		depth := strings.Count(rel, string(filepath.Separator))
		if d.IsDir() {
			base := d.Name()
			if depth > 2 || base == "vendor" || base == "node_modules" || (len(base) > 0 && base[0] == '.') {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(d.Name(), "_test.go") {
			found = true
			return filepath.SkipAll
		}
		return nil
	})
	return found
}

// --- agent doc scanning ---

func scanAgentDocs(root string, m *Manifest) {
	agentDocs := []struct {
		path   string
		name   string
		detail string
	}{
		{"AGENTS.md", "AGENTS", "agent instructions"},
		{"CLAUDE.md", "CLAUDE", "Claude-specific instructions"},
		{"GT.md", "GT", "Gas Town operational guidelines"},
		{"CODEX.md", "CODEX", "Codex-specific instructions"},
	}
	for _, d := range agentDocs {
		if exists(root, d.path) {
			m.Artifacts = append(m.Artifacts, Artifact{
				Path: d.path, Type: TypeAgentDoc, Name: d.name, Detail: d.detail,
			})
		}
	}
}

// --- helpers ---

func exists(root, rel string) bool {
	_, err := os.Stat(filepath.Join(root, rel))
	return err == nil
}
