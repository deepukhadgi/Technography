# Obsidian Vault Configuration

## Vault Settings
This vault is synced via Gitea on the local network.

### Sync Settings
- **Sync method**: Git via Gitea
- **Remote**: SSH server at port 2222
- **Branch**: main
- **Auto-sync**: Enabled (when connected to LAN)

### Plugins (recommended)
- **Obsidian Git**: For automatic git operations
- **Sync**: For additional sync options

### Mobile Setup (iOS)
For iOS sync with Obsidian:
1. Install **Working Copy** app (~$5) from App Store
2. Add SSH repository:
   - Host: the dockersrv IP
   - Port: 2222
   - Path: `/rwomehyo/obsidian-vault.git`
   - Auth: SSH key (auto-configured)
3. Clone the repository
4. In Obsidian, open the folder from Working Copy
5. Use Working Copy's built-in pull/push for sync

### Desktop Setup (macOS/Linux)
1. Clone the repository via SSH
2. Open in Obsidian
3. Use Obsidian Git plugin for auto-sync

### Notes
- All notes are in Markdown format
- Attachments go in `attachments/` folder
- Daily notes go in `daily-notes/` folder
- Templates go in `templates/` folder
