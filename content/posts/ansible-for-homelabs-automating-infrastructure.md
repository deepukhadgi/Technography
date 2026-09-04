---
title: "Ansible for Homelabs: Automating Your Infrastructure with 50 Lines of YAML"
date: "2026-09-04"
excerpt: "Tired of SSHing into three machines to do the same thing? Ansible lets you describe your homelab's desired state in plain YAML and push it everywhere at once — no agents, no complexity."
tags: ["ansible", "automation", "homelab", "devops"]
---

At some point every homelab hits a wall. You install Docker on one machine, then another, then a third. You tweak the same sshd config across all of them. You manually install `htop`, `vim`, `fail2ban` — and then you get a new machine and do it all over again.

That's the moment Ansible makes sense.

Ansible is a configuration management tool. You write YAML that describes what your machines should look like, and Ansible makes it so — across all of them, in one command, idempotently. You can run it twenty times and the end state is always the same. Nothing breaks if a package is already installed.

This post shows you a real, working Ansible setup for a homelab with three machines. Every file is under 50 lines. You'll have working automation within the hour.

## What Ansible actually does

Ansible connects to your machines over SSH — no agents, no daemons, no ports to open. It copies small Python scripts, runs them on the remote machine, reports results back, and cleans up. That's the entire mechanism.

Your "infrastructure as code" lives in **playbooks** — YAML files that describe a sequence of tasks. A task is atomic: install a package, write a file, restart a service, create a user. The collection of all your playbooks and supporting files is called a **project**.

```
ansible-homelab/
├── inventory.ini        # Which machines to manage
├── ansible.cfg          # Project-local config
├── site.yml             # Master playbook (includes everything)
└── roles/
    ├── common/          # Runs on every machine
    │   └── tasks/
    │       └── main.yml
    ├── docker/          # Docker installation role
    │   └── tasks/
    │       └── main.yml
    └── hardening/       # Security baseline
        └── tasks/
            └── main.yml
```

Roles are reusable units. You write the Docker role once and apply it to any machine in your inventory. Same for hardening. The `common` role runs on every host. That's it.

## The inventory: telling Ansible about your machines

The inventory is where you list your machines. Ansible calls them **hosts**, and you group them logically.

```ini
# inventory.ini
[homelab]
server1  ansible_host=<YOUR_SERVER_1_IP>
server2  ansible_host=<YOUR_SERVER_2_IP>
server3  ansible_host=<YOUR_SERVER_3_IP>

[docker_hosts]
server1
server2

[web_servers]
server3

[homelab:vars]
ansible_user=<YOUR_USERNAME>
ansible_ssh_private_key_file=~/.ssh/id_ed25519
ansible_python_interpreter=/usr/bin/python3
```

The `[homelab:vars]` block applies to every host in the `[homelab]` group. You set the SSH user once, the key once, and every playbook inherits it.

Test connectivity before writing a single playbook:

```bash
ansible homelab -i inventory.ini -m ping
```

Expected output:

```
server1 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
server2 | SUCCESS => ...
server3 | SUCCESS => ...
```

If ping fails, check your SSH key auth first. Ansible will tell you exactly why it can't connect — the error messages are clear.

## The common role: a consistent baseline everywhere

The `common` role runs on every machine, every time. It installs baseline tools, enforces timezone, and creates your standard user setup.

```yaml
# roles/common/tasks/main.yml
---
- name: Update apt cache and upgrade packages
  apt:
    update_cache: true
    upgrade: dist
    cache_valid_time: 3600
  become: true

- name: Install baseline tools
  apt:
    name:
      - htop
      - vim
      - curl
      - wget
      - git
      - tmux
      - unattended-upgrades
      - fail2ban
      - ufw
    state: present
  become: true

- name: Set timezone to UTC
  timezone:
    name: UTC
  become: true

- name: Enable and start unattended-upgrades
  service:
    name: unattended-upgrades
    state: started
    enabled: true
  become: true
```

The `become: true` is `sudo`. Ansible drops to root for privileged ops and back to your user for everything else. You don't need to be root permanently — Ansible escalates only when the task requires it.

`cache_valid_time: 3600` means "skip the apt cache update if it was refreshed within the last hour." This makes reruns fast — you don't wait for `apt-get update` on machines that are already up to date.

## The Docker role: install once, run everywhere

Installing Docker by hand involves curling a script and hoping it still works. Ansible's `docker` role makes it reproducible.

```yaml
# roles/docker/tasks/main.yml
---
- name: Install Docker prerequisites
  apt:
    name:
      - ca-certificates
      - gnupg
    state: present
  become: true

- name: Add Docker GPG key
  apt_key:
    url: https://download.docker.com/linux/ubuntu/gpg
    state: present
  become: true

- name: Add Docker repository
  apt_repository:
    repo: "deb [arch=amd64] https://download.docker.com/linux/ubuntu {{ ansible_distribution_release }} stable"
    state: present
  become: true

- name: Install Docker Engine
  apt:
    name:
      - docker-ce
      - docker-ce-cli
      - containerd.io
      - docker-compose-plugin
    state: present
    update_cache: true
  become: true

- name: Add user to docker group
  user:
    name: "{{ ansible_user }}"
    groups: docker
    append: true
  become: true

- name: Enable Docker service
  service:
    name: docker
    state: started
    enabled: true
  become: true
```

`{{ ansible_distribution_release }}` is a **fact** — Ansible discovers it automatically when it connects. If your machine runs Ubuntu 24.04 (Noble), it fills in `noble`. Ubuntu 22.04? `jammy`. You don't hardcode it.

Run this once and Docker is installed on every machine in `[docker_hosts]`. Run it again six months later and nothing changes — Ansible verifies the packages are present and moves on.

## The hardening role: security baseline in 20 lines

```yaml
# roles/hardening/tasks/main.yml
---
- name: Configure UFW defaults
  ufw:
    direction: "{{ item.direction }}"
    policy: "{{ item.policy }}"
  loop:
    - { direction: incoming, policy: deny }
    - { direction: outgoing, policy: allow }
  become: true

- name: Allow SSH through UFW
  ufw:
    rule: allow
    port: "22"
    proto: tcp
  become: true

- name: Enable UFW
  ufw:
    state: enabled
  become: true

- name: Harden SSH config
  lineinfile:
    path: /etc/ssh/sshd_config
    regexp: "{{ item.regexp }}"
    line: "{{ item.line }}"
    state: present
  loop:
    - { regexp: '^#?PermitRootLogin', line: 'PermitRootLogin no' }
    - { regexp: '^#?PasswordAuthentication', line: 'PasswordAuthentication no' }
    - { regexp: '^#?MaxAuthTries', line: 'MaxAuthTries 3' }
  notify: Restart SSH
  become: true

handlers:
  - name: Restart SSH
    service:
      name: ssh
      state: restarted
    become: true
```

The `handlers` section is Ansible's deferred execution model. When "Harden SSH config" runs and changes the file, it triggers the "Restart SSH" handler — but only at the end of the play, not immediately. If three tasks all notify the same handler, the service restarts once, not three times.

## The master playbook: wire it together

```yaml
# site.yml
---
- name: Apply common baseline
  hosts: homelab
  roles:
    - common
    - hardening

- name: Install Docker on Docker hosts
  hosts: docker_hosts
  roles:
    - docker
```

Run it:

```bash
ansible-playbook -i inventory.ini site.yml
```

Ansible connects to each host, runs the roles in order, reports what changed (yellow) and what was already correct (green). A fully converged run is all green — nothing changed because everything was already in the desired state.

## Practical patterns that actually matter

**Use `--check` before you commit to a change.** Ansible's dry-run mode shows you what would change without making any changes:

```bash
ansible-playbook -i inventory.ini site.yml --check
```

Don't skip this. On anything touching SSH config or UFW, a dry run has saved me from locking myself out more than once.

**Use `--limit` to target one host.** You don't need to run the entire playbook on all machines to test a change:

```bash
ansible-playbook -i inventory.ini site.yml --limit server1
```

Test on one, then roll out to the rest.

**Ansible Vault for secrets.** If a playbook needs a password or API key, don't put it in plaintext YAML. Use Vault:

```bash
ansible-vault create secrets.yml
# Opens $EDITOR — write your secrets as YAML, save and close
```

Reference it in your playbook:

```yaml
- name: Create database user
  postgresql_user:
    name: myapp
    password: "{{ db_password }}"
```

Run with:

```bash
ansible-playbook -i inventory.ini site.yml --ask-vault-pass
```

The secret is encrypted at rest and never touches your screen.

## The real value: rebuilding from scratch

The moment you appreciate Ansible most is when a VM dies — or when you add new hardware. Instead of a three-hour marathon of package installs and config files, you update the inventory, run `ansible-playbook -i inventory.ini site.yml`, and watch everything converge.

Thirty to forty minutes, depending on your internet connection and how many packages need installing. The machine is fully configured: Docker, baseline tools, UFW rules, SSH hardening, timezone, auto-updates. Identical to every other machine in its group.

That's infrastructure as code in practice. Not a diagram. Not documentation. Code you run.

## Where to go next

This setup handles 80% of homelab automation needs. When you're ready to go further:

- **Dynamic inventory**: Instead of a static `inventory.ini`, query your Proxmox API for the live list of VMs. Never manually maintain the inventory again.
- **Templates with Jinja2**: Write config files with variables filled in per-host. One template, different outputs for each machine.
- **Ansible Galaxy**: Community roles for Nginx, Postgres, Let's Encrypt and more. Install in seconds, skip the boilerplate.
- **AWX**: The open-source web UI for Ansible. Schedule playbook runs, manage inventory, and see run history from a browser. Overkill for most homelabs, essential once you cross 20 machines.

Start with the static inventory and a single playbook. Run it against your next machine setup. You'll never manually configure a server the same way again.
