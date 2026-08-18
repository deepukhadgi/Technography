# Obsidian Vault Configuration

## Vault Settings
This vault is synced via Gitea on the local network.

### Sync Settings
- **Sync method**: Git via Gitea
- **Remote**: ssh://git@gitea/rwomehyo/obsidian-vault.git
- **Branch**: main
- **Auto-sync**: Enabled (when connected to LAN)

### Plugins (recommended)
- **Obsidian Git**: For automatic git operations
- **Sync**: For additional sync options

### Mobile Setup (iOS)
For iOS sync with Obsidian:
1. Install **Working Copy** app (~$5) from App Store
2. Clone the repository: `ssh://git@gitea/rwomehyo/obsidian-vault.git`
3. In Obsidian, open the folder from Working Copy
4. Use Working Copy's built-in pull/push for sync

### Desktop Setup (macOS/Linux)
1. Clone the repository: `git clone ssh://git@gitea/rwomehyo/obsidian-vault.git`
2. Open in Obsidian
3. Use Obsidian Git plugin for auto-sync

### Notes
- All notes are in Markdown format
- Attachments go in `attachments/` folder
- Daily notes go in `daily-notes/` folder
- Templates go in `templates/` folder
