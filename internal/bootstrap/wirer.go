// Package bootstrap provides repo scanning and discovery for gt rig bootstrap.
package bootstrap

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/steveyegge/gastown/internal/config"
	"github.com/steveyegge/gastown/internal/harness"
	"gopkg.in/yaml.v3"
)

// WireOptions controls config wirer behavior.
type WireOptions struct {
	// DryRun shows what would change without writing.
	DryRun bool
	// Yes accepts all discovered values without prompting.
	Yes bool
}

// Change describes a single config modification.
type Change struct {
	Field    string // e.g. "merge_queue.build_command"
	Old      string // existing value ("" if unset)
	New      string // discovered value
	Action   string // "set", "skip", "conflict"
	Reason   string // human-readable explanation
}

// WireResult summarizes what the wirer did.
type WireResult struct {
	Changes       []Change
	HarnessPath   string // path to generated/updated harness.yaml
	HarnessExists bool   // true if harness.yaml already existed
}

// WireConfig takes CI-parsed commands and a discovery manifest, then populates
// the rig's settings/config.json and generates .gastown/harness.yaml.
//
// On re-run it fills gaps, reports conflicts, and never overwrites manual values.
func WireConfig(rigPath string, cmds harness.Commands, manifest *Manifest, opts WireOptions) (*WireResult, error) {
	result := &WireResult{}

	// --- Load or create rig settings ---
	settingsPath := config.RigSettingsPath(rigPath)
	settings, err := loadOrCreateSettings(settingsPath)
	if err != nil {
		return nil, fmt.Errorf("loading rig settings: %w", err)
	}

	if settings.MergeQueue == nil {
		settings.MergeQueue = config.DefaultMergeQueueConfig()
	}
	mq := settings.MergeQueue

	// --- Wire command fields into MergeQueue ---
	wireField(result, &mq.SetupCommand, cmds.Setup, "merge_queue.setup_command")
	wireField(result, &mq.BuildCommand, cmds.Build, "merge_queue.build_command")
	wireField(result, &mq.TestCommand, cmds.Test, "merge_queue.test_command")
	wireField(result, &mq.LintCommand, cmds.Lint, "merge_queue.lint_command")
	wireField(result, &mq.TypecheckCommand, cmds.Typecheck, "merge_queue.typecheck_command")

	// --- Wire harness_defaults (lives on RigSettings, not MergeQueue) ---
	wireHarnessDefaults(result, settings, cmds)

	// --- Save rig settings ---
	if !opts.DryRun {
		if hasWrites(result) {
			if err := config.SaveRigSettings(settingsPath, settings); err != nil {
				return nil, fmt.Errorf("saving rig settings: %w", err)
			}
		}
	}

	// --- Generate .gastown/harness.yaml ---
	if err := wireHarnessYAML(rigPath, cmds, result, opts); err != nil {
		return nil, fmt.Errorf("writing harness.yaml: %w", err)
	}

	return result, nil
}

// wireField sets a MergeQueue field if it's empty and a discovered value exists.
// If both exist and differ, records a conflict. If both match, skips silently.
func wireField(result *WireResult, field *string, discovered, name string) {
	if discovered == "" {
		return // nothing discovered
	}
	if *field == "" {
		*field = discovered
		result.Changes = append(result.Changes, Change{
			Field:  name,
			New:    discovered,
			Action: "set",
			Reason: "discovered from CI/build config",
		})
		return
	}
	if *field == discovered {
		return // already matches
	}
	// Conflict: existing value differs from discovered.
	result.Changes = append(result.Changes, Change{
		Field:  name,
		Old:    *field,
		New:    discovered,
		Action: "conflict",
		Reason: fmt.Sprintf("existing %q differs from discovered %q", *field, discovered),
	})
}

// wireHarnessDefaults populates RigSettings.HarnessDefaults from discovered commands.
// Only fills missing tiers; never overwrites existing tier entries.
func wireHarnessDefaults(result *WireResult, settings *config.RigSettings, cmds harness.Commands) {
	if settings.HarnessDefaults == nil {
		settings.HarnessDefaults = make(map[string][]string)
	}

	tier0 := buildTier0(cmds)
	tier1 := buildTier1(cmds)

	if len(tier0) > 0 && len(settings.HarnessDefaults["tier0"]) == 0 {
		settings.HarnessDefaults["tier0"] = tier0
		result.Changes = append(result.Changes, Change{
			Field:  "harness_defaults.tier0",
			New:    strings.Join(tier0, ", "),
			Action: "set",
			Reason: "tier0 commands from CI discovery",
		})
	}

	if len(tier1) > 0 && len(settings.HarnessDefaults["tier1"]) == 0 {
		settings.HarnessDefaults["tier1"] = tier1
		result.Changes = append(result.Changes, Change{
			Field:  "harness_defaults.tier1",
			New:    strings.Join(tier1, ", "),
			Action: "set",
			Reason: "tier1 commands from CI discovery",
		})
	}
}

// wireHarnessYAML generates or updates .gastown/harness.yaml.
// If the file exists, only fills missing tiers.
func wireHarnessYAML(rigPath string, cmds harness.Commands, result *WireResult, opts WireOptions) error {
	harnessPath := filepath.Join(rigPath, harness.DefaultPath)
	result.HarnessPath = harnessPath

	existing, err := harness.LoadConfig(rigPath)
	if err != nil {
		return err
	}

	tier0 := buildTier0(cmds)
	tier1 := buildTier1(cmds)

	if existing != nil {
		result.HarnessExists = true
		// Only fill missing tiers.
		changed := false
		if len(existing.Tier0) == 0 && len(tier0) > 0 {
			existing.Tier0 = tier0
			changed = true
		}
		if len(existing.Tier1) == 0 && len(tier1) > 0 {
			existing.Tier1 = tier1
			changed = true
		}
		if !changed {
			return nil // nothing to update
		}
		if opts.DryRun {
			return nil
		}
		return writeHarnessYAML(harnessPath, existing)
	}

	// No existing file — generate from scratch.
	if len(tier0) == 0 && len(tier1) == 0 {
		return nil // nothing to write
	}

	cfg := &harness.Config{Tier0: tier0, Tier1: tier1}
	if opts.DryRun {
		return nil
	}
	return writeHarnessYAML(harnessPath, cfg)
}

func writeHarnessYAML(path string, cfg *harness.Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("creating directory: %w", err)
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("marshaling harness config: %w", err)
	}
	return os.WriteFile(path, data, 0644) //nolint:gosec // G306: harness config is not sensitive
}

// buildTier0 returns tier0 commands (build + test — must pass).
func buildTier0(cmds harness.Commands) []string {
	var tier []string
	if cmds.Build != "" {
		tier = append(tier, cmds.Build)
	}
	if cmds.Test != "" {
		tier = append(tier, cmds.Test)
	}
	return tier
}

// buildTier1 returns tier1 commands (lint + typecheck — should pass).
func buildTier1(cmds harness.Commands) []string {
	var tier []string
	if cmds.Lint != "" {
		tier = append(tier, cmds.Lint)
	}
	if cmds.Typecheck != "" {
		tier = append(tier, cmds.Typecheck)
	}
	return tier
}

// loadOrCreateSettings loads existing rig settings or creates defaults.
func loadOrCreateSettings(path string) (*config.RigSettings, error) {
	settings, err := config.LoadRigSettings(path)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return config.NewRigSettings(), nil
		}
		return nil, err
	}
	return settings, nil
}

// hasWrites returns true if any change has action "set".
func hasWrites(result *WireResult) bool {
	for _, c := range result.Changes {
		if c.Action == "set" {
			return true
		}
	}
	return false
}
