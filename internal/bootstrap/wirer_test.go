package bootstrap

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/steveyegge/gastown/internal/config"
	"github.com/steveyegge/gastown/internal/harness"
	"gopkg.in/yaml.v3"
)

func TestWireConfig_EmptyRepo(t *testing.T) {
	dir := t.TempDir()
	setupRigDir(t, dir)

	result, err := WireConfig(dir, harness.Commands{}, &Manifest{}, WireOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Changes) != 0 {
		t.Errorf("expected no changes for empty commands, got %d", len(result.Changes))
	}
}

func TestWireConfig_PopulatesEmptySettings(t *testing.T) {
	dir := t.TempDir()
	setupRigDir(t, dir)

	cmds := harness.Commands{
		Build:     "go build ./...",
		Test:      "go test ./...",
		Lint:      "golangci-lint run",
		Typecheck: "tsc --noEmit",
		Setup:     "make setup",
	}

	result, err := WireConfig(dir, cmds, &Manifest{}, WireOptions{})
	if err != nil {
		t.Fatal(err)
	}

	// Should have 7 changes: 5 command fields + tier0 + tier1
	setCount := 0
	for _, c := range result.Changes {
		if c.Action == "set" {
			setCount++
		}
	}
	if setCount != 7 {
		t.Errorf("expected 7 set changes, got %d", setCount)
	}

	// Verify settings file was written
	settings, err := config.LoadRigSettings(config.RigSettingsPath(dir))
	if err != nil {
		t.Fatal(err)
	}
	if settings.MergeQueue.BuildCommand != "go build ./..." {
		t.Errorf("build_command = %q, want %q", settings.MergeQueue.BuildCommand, "go build ./...")
	}
	if settings.MergeQueue.TestCommand != "go test ./..." {
		t.Errorf("test_command = %q, want %q", settings.MergeQueue.TestCommand, "go test ./...")
	}
	if settings.MergeQueue.LintCommand != "golangci-lint run" {
		t.Errorf("lint_command = %q, want %q", settings.MergeQueue.LintCommand, "golangci-lint run")
	}
	if settings.MergeQueue.SetupCommand != "make setup" {
		t.Errorf("setup_command = %q, want %q", settings.MergeQueue.SetupCommand, "make setup")
	}
}

func TestWireConfig_GeneratesHarnessYAML(t *testing.T) {
	dir := t.TempDir()
	setupRigDir(t, dir)

	cmds := harness.Commands{
		Build: "go build ./...",
		Test:  "go test ./...",
		Lint:  "golangci-lint run",
	}

	result, err := WireConfig(dir, cmds, &Manifest{}, WireOptions{})
	if err != nil {
		t.Fatal(err)
	}

	if result.HarnessPath == "" {
		t.Fatal("expected harness path to be set")
	}

	data, err := os.ReadFile(result.HarnessPath)
	if err != nil {
		t.Fatal(err)
	}
	var cfg harness.Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		t.Fatal(err)
	}
	if len(cfg.Tier0) != 2 {
		t.Errorf("tier0 len = %d, want 2", len(cfg.Tier0))
	}
	if len(cfg.Tier1) != 1 {
		t.Errorf("tier1 len = %d, want 1", len(cfg.Tier1))
	}
}

func TestWireConfig_FillsGaps(t *testing.T) {
	dir := t.TempDir()
	setupRigDir(t, dir)

	// Pre-populate with build_command only
	settings := config.NewRigSettings()
	settings.MergeQueue = config.DefaultMergeQueueConfig()
	settings.MergeQueue.BuildCommand = "make build"
	if err := config.SaveRigSettings(config.RigSettingsPath(dir), settings); err != nil {
		t.Fatal(err)
	}

	cmds := harness.Commands{
		Build: "go build ./...",
		Test:  "go test ./...",
		Lint:  "golangci-lint run",
	}

	result, err := WireConfig(dir, cmds, &Manifest{}, WireOptions{})
	if err != nil {
		t.Fatal(err)
	}

	// build_command should be a conflict (existing differs from discovered)
	// test_command and lint_command should be set
	var conflicts, sets int
	for _, c := range result.Changes {
		switch c.Action {
		case "conflict":
			conflicts++
			if c.Field != "merge_queue.build_command" {
				t.Errorf("unexpected conflict field: %s", c.Field)
			}
		case "set":
			sets++
		}
	}
	if conflicts != 1 {
		t.Errorf("expected 1 conflict, got %d", conflicts)
	}

	// Verify build_command was NOT overwritten
	reloaded, err := config.LoadRigSettings(config.RigSettingsPath(dir))
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.MergeQueue.BuildCommand != "make build" {
		t.Errorf("build_command was overwritten: got %q", reloaded.MergeQueue.BuildCommand)
	}
	if reloaded.MergeQueue.TestCommand != "go test ./..." {
		t.Errorf("test_command not filled: got %q", reloaded.MergeQueue.TestCommand)
	}
}

func TestWireConfig_NeverOverwritesExistingHarness(t *testing.T) {
	dir := t.TempDir()
	setupRigDir(t, dir)

	// Pre-create harness.yaml with custom tier0
	harnessDir := filepath.Join(dir, ".gastown")
	if err := os.MkdirAll(harnessDir, 0755); err != nil {
		t.Fatal(err)
	}
	existing := harness.Config{Tier0: []string{"custom-build"}}
	data, _ := yaml.Marshal(&existing)
	if err := os.WriteFile(filepath.Join(harnessDir, "harness.yaml"), data, 0644); err != nil {
		t.Fatal(err)
	}

	cmds := harness.Commands{
		Build: "go build ./...",
		Test:  "go test ./...",
		Lint:  "golangci-lint run",
	}

	result, err := WireConfig(dir, cmds, &Manifest{}, WireOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !result.HarnessExists {
		t.Error("expected HarnessExists=true")
	}

	// Verify tier0 was NOT overwritten
	reloaded, err := harness.LoadConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(reloaded.Tier0) != 1 || reloaded.Tier0[0] != "custom-build" {
		t.Errorf("tier0 was overwritten: got %v", reloaded.Tier0)
	}
	// tier1 should have been filled
	if len(reloaded.Tier1) != 1 || reloaded.Tier1[0] != "golangci-lint run" {
		t.Errorf("tier1 not filled: got %v", reloaded.Tier1)
	}
}

func TestWireConfig_DryRun(t *testing.T) {
	dir := t.TempDir()
	setupRigDir(t, dir)

	cmds := harness.Commands{Build: "go build ./...", Test: "go test ./..."}

	result, err := WireConfig(dir, cmds, &Manifest{}, WireOptions{DryRun: true})
	if err != nil {
		t.Fatal(err)
	}

	// Should report changes but not write files
	if len(result.Changes) == 0 {
		t.Error("expected changes in dry run")
	}

	// Settings file should not exist
	if _, err := os.Stat(config.RigSettingsPath(dir)); !os.IsNotExist(err) {
		t.Error("settings file should not exist in dry run")
	}

	// Harness file should not exist
	if _, err := os.Stat(filepath.Join(dir, harness.DefaultPath)); !os.IsNotExist(err) {
		t.Error("harness file should not exist in dry run")
	}
}

func TestWireConfig_MatchingValuesNoConflict(t *testing.T) {
	dir := t.TempDir()
	setupRigDir(t, dir)

	// Pre-populate with same value as discovery
	settings := config.NewRigSettings()
	settings.MergeQueue = config.DefaultMergeQueueConfig()
	settings.MergeQueue.BuildCommand = "go build ./..."
	if err := config.SaveRigSettings(config.RigSettingsPath(dir), settings); err != nil {
		t.Fatal(err)
	}

	cmds := harness.Commands{Build: "go build ./..."}

	result, err := WireConfig(dir, cmds, &Manifest{}, WireOptions{})
	if err != nil {
		t.Fatal(err)
	}

	// No conflict when values match
	for _, c := range result.Changes {
		if c.Action == "conflict" {
			t.Errorf("unexpected conflict: %s", c.Field)
		}
	}
}

// setupRigDir creates the minimal directory structure for a rig.
func setupRigDir(t *testing.T, dir string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(dir, "settings"), 0755); err != nil {
		t.Fatal(err)
	}
}
