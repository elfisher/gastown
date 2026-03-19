package harness

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// HarnessConfig represents the .gastown/harness.yaml file structure.
// Tier0 commands are fast gates (build, typecheck). Tier1 commands are
// slower gates (full test suite, lint). If any tier0 command fails,
// tier1 is skipped entirely.
type HarnessConfig struct {
	Tier0 []string `yaml:"tier0"`
	Tier1 []string `yaml:"tier1"`
}

// HarnessPath is the conventional location for the harness config file.
const HarnessPath = ".gastown/harness.yaml"

// LoadHarness reads the harness config from repoRoot/.gastown/harness.yaml.
// Returns nil tiers (not an error) if the file does not exist — harness is
// optional. Returns an error only if the file exists but is malformed.
func LoadHarness(repoRoot string) ([][]string, error) {
	path := filepath.Join(repoRoot, HarnessPath)
	data, err := os.ReadFile(path) //nolint:gosec // G304: path from trusted rig config
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // No harness configured — not an error
		}
		return nil, fmt.Errorf("reading harness config: %w", err)
	}

	var cfg HarnessConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing harness config %s: %w", path, err)
	}

	var tiers [][]string
	if len(cfg.Tier0) > 0 {
		tiers = append(tiers, cfg.Tier0)
	}
	if len(cfg.Tier1) > 0 {
		tiers = append(tiers, cfg.Tier1)
	}
	return tiers, nil
}
