package bootstrap

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestScanRepo_GoProject(t *testing.T) {
	dir := t.TempDir()

	// Create a minimal Go project layout.
	touch(t, dir, "go.mod")
	touch(t, dir, "README.md")
	touch(t, dir, "CONTRIBUTING.md")
	touch(t, dir, ".golangci.yml")
	touch(t, dir, ".editorconfig")
	touch(t, dir, "Makefile")
	mkdir(t, dir, ".github", "workflows")
	touch(t, dir, ".github/workflows/ci.yml")
	mkdir(t, dir, "internal")
	touch(t, dir, "internal/foo_test.go")

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}

	assertHas(t, m, TypeDoc, "README")
	assertHas(t, m, TypeDoc, "CONTRIBUTING")
	assertHas(t, m, TypeLintConfig, "golangci-lint")
	assertHas(t, m, TypeEditorCfg, "editorconfig")
	assertHas(t, m, TypeBuildFile, "go.mod")
	assertHas(t, m, TypeBuildFile, "Makefile")
	assertHas(t, m, TypeCIConfig, "ci")
	assertHas(t, m, TypeTestDir, "go-inline-tests")
}

func TestScanRepo_NodeProject(t *testing.T) {
	dir := t.TempDir()

	touch(t, dir, "package.json")
	touch(t, dir, "tsconfig.json")
	touch(t, dir, ".eslintrc.json")
	touch(t, dir, ".prettierrc")
	touch(t, dir, "jest.config.ts")
	mkdir(t, dir, "__tests__")

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}

	assertHas(t, m, TypeBuildFile, "package.json")
	assertHas(t, m, TypeTSConfig, "tsconfig")
	assertHas(t, m, TypeLintConfig, "eslint")
	assertHas(t, m, TypeFmtConfig, "prettier")
	assertHas(t, m, TypeTestConfig, "jest")
	assertHas(t, m, TypeTestDir, "__tests__")
}

func TestScanRepo_EmptyDir(t *testing.T) {
	dir := t.TempDir()

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Artifacts) != 0 {
		t.Errorf("expected 0 artifacts in empty dir, got %d", len(m.Artifacts))
	}
}

func TestManifest_JSON(t *testing.T) {
	m := &Manifest{
		Root: "/tmp/test",
		Artifacts: []Artifact{
			{Path: "README.md", Type: TypeDoc, Name: "README", Detail: "project overview"},
		},
	}
	data, err := m.JSON()
	if err != nil {
		t.Fatal(err)
	}

	var parsed Manifest
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatal(err)
	}
	if len(parsed.Artifacts) != 1 {
		t.Fatalf("expected 1 artifact, got %d", len(parsed.Artifacts))
	}
	if parsed.Artifacts[0].Name != "README" {
		t.Errorf("expected README, got %s", parsed.Artifacts[0].Name)
	}
}

func TestScanRepo_AgentDocs(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "AGENTS.md")
	touch(t, dir, "CLAUDE.md")
	touch(t, dir, "GT.md")

	m, err := ScanRepo(dir)
	if err != nil {
		t.Fatal(err)
	}

	assertHas(t, m, TypeAgentDoc, "AGENTS")
	assertHas(t, m, TypeAgentDoc, "CLAUDE")
	assertHas(t, m, TypeAgentDoc, "GT")
}

// --- helpers ---

func touch(t *testing.T, dir, rel string) {
	t.Helper()
	p := filepath.Join(dir, rel)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, nil, 0o644); err != nil {
		t.Fatal(err)
	}
}

func mkdir(t *testing.T, parts ...string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(parts...), 0o755); err != nil {
		t.Fatal(err)
	}
}

func assertHas(t *testing.T, m *Manifest, typ ArtifactType, name string) {
	t.Helper()
	for _, a := range m.Artifacts {
		if a.Type == typ && a.Name == name {
			return
		}
	}
	t.Errorf("manifest missing artifact type=%s name=%s", typ, name)
}
