package harness

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Harness holds merged verification command lists for a bead.
type Harness struct {
	Tier0 []string `yaml:"tier0"`
	Tier1 []string `yaml:"tier1"`
}

// Tiers returns the tiers as a [][]string suitable for RunTiered.
func (h *Harness) Tiers() [][]string {
	var tiers [][]string
	if len(h.Tier0) > 0 {
		tiers = append(tiers, h.Tier0)
	}
	if len(h.Tier1) > 0 {
		tiers = append(tiers, h.Tier1)
	}
	return tiers
}

// LoadHarness reads layered harness config and returns merged command lists.
// Layer priority (highest first):
//  1. Bead-specific: <rigPath>/.gastown/harness/<beadID>.yaml
//  2. Repo-level:    <rigPath>/.gastown/harness.yaml
//  3. Rig defaults:  tier0/tier1 passed from RigConfig.HarnessDefaults
//
// Each layer overrides the one below it per-tier (non-nil slice replaces).
func LoadHarness(rigPath, beadID string, defaults *Harness) (*Harness, error) {
	result := &Harness{}

	// Layer 3: rig config defaults (lowest priority).
	if defaults != nil {
		result.Tier0 = defaults.Tier0
		result.Tier1 = defaults.Tier1
	}

	// Layer 2: repo-level .gastown/harness.yaml.
	repoFile := filepath.Join(rigPath, ".gastown", "harness.yaml")
	if err := mergeFromFile(repoFile, result); err != nil {
		return nil, err
	}

	// Layer 1: bead-specific .gastown/harness/<beadID>.yaml.
	if beadID != "" {
		beadFile := filepath.Join(rigPath, ".gastown", "harness", beadID+".yaml")
		if err := mergeFromFile(beadFile, result); err != nil {
			return nil, err
		}
	}

	return result, nil
}

// mergeFromFile reads a YAML file and merges non-nil tiers into dst.
func mergeFromFile(path string, dst *Harness) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var layer Harness
	if err := yaml.Unmarshal(data, &layer); err != nil {
		return err
	}
	if layer.Tier0 != nil {
		dst.Tier0 = layer.Tier0
	}
	if layer.Tier1 != nil {
		dst.Tier1 = layer.Tier1
	}
	return nil
}
