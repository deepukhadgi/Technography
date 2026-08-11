#!/usr/bin/env python3
"""
Diagram Generator v2 - Multi-layout style randomizer
Generates varied diagram styles for Technography blog posts.
"""
import os
import random
import math
from PIL import Image, ImageDraw, ImageFont

# ─── Configuration ───────────────────────────────────────────────────────────
REPO = "/home/rwomehyo/projects/Technography"
IMG_DIR = os.path.join(REPO, "public/images")
os.makedirs(IMG_DIR, exist_ok=True)

# Color palette
COLORS = {
    "cyan": "#22d3ee",
    "emerald": "#34d399", 
    "amber": "#fbbf24",
    "violet": "#a78bfa",
    "rose": "#fb7185",
    "slate": "#94a3b8",
    "fg": "#e2e8f0",
    "dim": "#94a3b8",
    "bg": "#0f172a",
    "panel": "#1e293b",
}

# Layout styles
LAYOUTS = [
    "horizontal_flow",   # Boxes left-to-right with arrows
    "vertical_stack",    # Boxes top-to-bottom
    "comparison",        # Two columns (vs style)
    "grid",              # 2x2 or 3x2 grid
    "network",           # Central hub with spokes
    "pipeline",          # Vertical pipeline with stages
]


def get_font(size):
    """Get monospace font or fallback."""
    fonts = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
    ]
    for f in fonts:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def save_diagram(img, slug):
    """Save diagram with unique filename to avoid conflicts."""
    out = os.path.join(IMG_DIR, f"{slug}-diagram.png")
    img.save(out, "PNG")
    return out


def draw_horizontal_flow(img, d, title, components, insight):
    """Standard horizontal flow: A → B → C → D"""
    W, H = img.size
    box_w, box_h = 180, 80
    gap = 40
    start_x = (W - (len(components) * box_w + (len(components) - 1) * gap)) // 2
    start_y = 180
    
    for i, (name, sub, fill, stroke) in enumerate(components):
        x = start_x + i * (box_w + gap)
        d.rounded_rectangle([x, start_y, x+box_w, start_y+box_h], radius=10, 
                           fill=fill, outline=stroke, width=2)
        # Center text
        bbox = d.textbbox((0,0), name, font=get_font(22))
        tw = bbox[2]-bbox[0]
        d.text((x + box_w//2 - tw//2, start_y + 25), name, fill=stroke, font=get_font(22))
        if sub:
            bbox2 = d.textbbox((0,0), sub, font=get_font(14))
            tw2 = bbox2[2]-bbox2[0]
            d.text((x + box_w//2 - tw2//2, start_y + 55), sub, fill=COLORS["dim"], font=get_font(14))
        
        # Arrow to next
        if i < len(components) - 1:
            ax1, ay1 = x + box_w + 2, start_y + 40
            ax2, ay2 = x + box_w + gap - 2, start_y + 40
            d.line([(ax1, ay1), (ax2, ay2)], fill=stroke, width=3)
            # Arrowhead
            import math
            ang = math.atan2(ay2-ay1, ax2-ax1)
            ax = ax2 - 12*math.cos(ang-0.3)
            ay = ay2 - 12*math.sin(ang-0.3)
            bx = ax2 - 12*math.cos(ang+0.3)
            by = ay2 - 12*math.sin(ang+0.3)
            d.polygon([(ax2, ay2), (ax, ay), (bx, by)], fill=stroke)
    
    # Insight box
    if insight:
        iy = 320
        d.rounded_rectangle([100, iy, W-100, iy+50], radius=8, 
                           fill="#064e3b", outline=COLORS["emerald"], width=2)
        bbox = d.textbbox((0,0), insight, font=get_font(16))
        tw = bbox[2]-bbox[0]
        d.text((W//2 - tw//2, iy+15), insight, fill=COLORS["emerald"], font=get_font(16))


def draw_vertical_stack(img, d, title, components, insight):
    """Vertical stack: top to bottom flow"""
    W, H = img.size
    box_w, box_h = 200, 70
    gap = 30
    start_x = (W - box_w) // 2
    start_y = 120
    
    for i, (name, sub, fill, stroke) in enumerate(components):
        y = start_y + i * (box_h + gap)
        d.rounded_rectangle([start_x, y, start_x+box_w, y+box_h], radius=10,
                           fill=fill, outline=stroke, width=2)
        bbox = d.textbbox((0,0), name, font=get_font(20))
        tw = bbox[2]-bbox[0]
        d.text((start_x + box_w//2 - tw//2, y + 20), name, fill=stroke, font=get_font(20))
        if sub:
            bbox2 = d.textbbox((0,0), sub, font=get_font(14))
            tw2 = bbox2[2]-bbox2[0]
            d.text((start_x + box_w//2 - tw2//2, y + 45), sub, fill=COLORS["dim"], font=get_font(14))
        
        # Arrow down
        if i < len(components) - 1:
            ax1, ay1 = start_x + box_w//2, y + box_h
            ax2, ay2 = start_x + box_w//2, y + box_h + gap
            d.line([(ax1, ay1), (ax2, ay2)], fill=stroke, width=3)
            d.polygon([(ax2, ay2), (ax2-8, ay2-12), (ax2+8, ay2-12)], fill=stroke)
    
    # Insight
    if insight:
        iy = 350
        d.rounded_rectangle([100, iy, W-100, iy+50], radius=8,
                           fill="#064e3b", outline=COLORS["emerald"], width=2)
        bbox = d.textbbox((0,0), insight, font=get_font(16))
        tw = bbox[2]-bbox[0]
        d.text((W//2 - tw//2, iy+15), insight, fill=COLORS["emerald"], font=get_font(16))


def draw_comparison(img, d, title, left_comp, right_comp, insight):
    """Two-column comparison diagram"""
    W, H = img.size
    box_w, box_h = 220, 70
    gap = 50
    start_y = 140
    
    # Left column
    for i, (name, sub, fill, stroke) in enumerate(left_comp):
        x = 80
        y = start_y + i * (box_h + 20)
        d.rounded_rectangle([x, y, x+box_w, y+box_h], radius=10,
                           fill=fill, outline=stroke, width=2)
        bbox = d.textbbox((0,0), name, font=get_font(20))
        tw = bbox[2]-bbox[0]
        d.text((x + box_w//2 - tw//2, y + 22), name, fill=stroke, font=get_font(20))
        if sub:
            bbox2 = d.textbbox((0,0), sub, font=get_font(14))
            tw2 = bbox2[2]-bbox2[0]
            d.text((x + box_w//2 - tw2//2, y + 48), sub, fill=COLORS["dim"], font=get_font(14))
    
    # Right column
    for i, (name, sub, fill, stroke) in enumerate(right_comp):
        x = W - 80 - box_w
        y = start_y + i * (box_h + 20)
        d.rounded_rectangle([x, y, x+box_w, y+box_h], radius=10,
                           fill=fill, outline=stroke, width=2)
        bbox = d.textbbox((0,0), name, font=get_font(20))
        tw = bbox[2]-bbox[0]
        d.text((x + box_w//2 - tw//2, y + 22), name, fill=stroke, font=get_font(20))
        if sub:
            bbox2 = d.textbbox((0,0), sub, font=get_font(14))
            tw2 = bbox2[2]-bbox2[0]
            d.text((x + box_w//2 - tw2//2, y + 48), sub, fill=COLORS["dim"], font=get_font(14))
    
    # VS badge
    d.rounded_rectangle([W//2-25, start_y + 100, W//2+25, start_y + 140], radius=20,
                       fill="#78350f", outline=COLORS["amber"], width=2)
    d.text((W//2, start_y + 118), "VS", fill=COLORS["amber"], font=get_font(20))
    
    # Insight
    if insight:
        iy = 420
        d.rounded_rectangle([100, iy, W-100, iy+50], radius=8,
                           fill="#064e3b", outline=COLORS["emerald"], width=2)
        bbox = d.textbbox((0,0), insight, font=get_font(16))
        tw = bbox[2]-bbox[0]
        d.text((W//2 - tw//2, iy+15), insight, fill=COLORS["emerald"], font=get_font(16))


def draw_grid(img, d, title, components, insight):
    """Grid layout: 2x2 or 3x2"""
    W, H = img.size
    cols = 2 if len(components) <= 4 else 3
    rows = (len(components) + cols - 1) // cols
    box_w = (W - 100) // cols
    box_h = 90
    gap = 20
    start_x = 50
    start_y = 140
    
    for i, (name, sub, fill, stroke) in enumerate(components):
        col = i % cols
        row = i // cols
        x = start_x + col * (box_w + gap)
        y = start_y + row * (box_h + gap)
        
        d.rounded_rectangle([x, y, x+box_w, y+box_h], radius=10,
                           fill=fill, outline=stroke, width=2)
        bbox = d.textbbox((0,0), name, font=get_font(20))
        tw = bbox[2]-bbox[0]
        d.text((x + box_w//2 - tw//2, y + 25), name, fill=stroke, font=get_font(20))
        if sub:
            bbox2 = d.textbbox((0,0), sub, font=get_font(14))
            tw2 = bbox2[2]-bbox2[0]
            d.text((x + box_w//2 - tw2//2, y + 55), sub, fill=COLORS["dim"], font=get_font(14))
    
    # Insight
    if insight:
        iy = 380
        d.rounded_rectangle([100, iy, W-100, iy+50], radius=8,
                           fill="#064e3b", outline=COLORS["emerald"], width=2)
        bbox = d.textbbox((0,0), insight, font=get_font(16))
        tw = bbox[2]-bbox[0]
        d.text((W//2 - tw//2, iy+15), insight, fill=COLORS["emerald"], font=get_font(16))


def draw_network(img, d, title, center, spokes, insight):
    """Hub-and-spoke network diagram"""
    W, H = img.size
    cx, cy = W//2, 280
    radius = 180
    
    # Draw spokes
    for i, (name, sub, fill, stroke) in enumerate(spokes):
        angle = (i / len(spokes)) * 2 * 3.14159 - 3.14159/2
        ex = cx + radius * math.cos(angle)
        ey = cy + radius * math.sin(angle)
        
        # Line
        d.line([(cx, cy), (ex, ey)], fill=stroke, width=2)
        
        # Box at end
        bw, bh = 160, 60
        bx = ex - bw//2
        by = ey - bh//2
        d.rounded_rectangle([bx, by, bx+bw, by+bh], radius=8,
                           fill=fill, outline=stroke, width=2)
        bbox = d.textbbox((0,0), name, font=get_font(18))
        tw = bbox[2]-bbox[0]
        d.text((bx + bw//2 - tw//2, by + 18), name, fill=stroke, font=get_font(18))
        if sub:
            bbox2 = d.textbbox((0,0), sub, font=get_font(12))
            tw2 = bbox2[2]-bbox2[0]
            d.text((bx + bw//2 - tw2//2, by + 38), sub, fill=COLORS["dim"], font=get_font(12))
    
    # Center box
    cw, ch = 140, 60
    d.rounded_rectangle([cx-cw//2, cy-ch//2, cx+cw//2, cy+ch//2], radius=10,
                       fill="#064e3b", outline=COLORS["emerald"], width=3)
    bbox = d.textbbox((0,0), center, font=get_font(20))
    tw = bbox[2]-bbox[0]
    d.text((cx-tw//2, cy-10), center, fill=COLORS["emerald"], font=get_font(20))
    
    # Insight
    if insight:
        iy = 480
        d.rounded_rectangle([100, iy, W-100, iy+50], radius=8,
                           fill="#064e3b", outline=COLORS["emerald"], width=2)
        bbox = d.textbbox((0,0), insight, font=get_font(16))
        tw = bbox[2]-bbox[0]
        d.text((W//2 - tw//2, iy+15), insight, fill=COLORS["emerald"], font=get_font(16))


def draw_pipeline(img, d, title, components, insight):
    """Pipeline: vertical stages with connecting lines"""
    W, H = img.size
    box_w, box_h = 240, 60
    gap = 25
    start_x = (W - box_w) // 2
    start_y = 120
    
    for i, (name, sub, fill, stroke) in enumerate(components):
        y = start_y + i * (box_h + gap)
        
        # Stage number
        d.rounded_rectangle([start_x - 40, y + 10, start_x - 10, y + box_h - 10], 
                           radius=15, fill=fill, outline=stroke, width=2)
        d.text((start_x - 25, y + 20), str(i+1), fill=stroke, font=get_font(20))
        
        # Main box
        d.rounded_rectangle([start_x, y, start_x+box_w, y+box_h], radius=10,
                           fill=fill, outline=stroke, width=2)
        bbox = d.textbbox((0,0), name, font=get_font(18))
        tw = bbox[2]-bbox[0]
        d.text((start_x + box_w//2 - tw//2, y + 15), name, fill=stroke, font=get_font(18))
        if sub:
            bbox2 = d.textbbox((0,0), sub, font=get_font(13))
            tw2 = bbox2[2]-bbox2[0]
            d.text((start_x + box_w//2 - tw2//2, y + 38), sub, fill=COLORS["dim"], font=get_font(13))
        
        # Connector line
        if i < len(components) - 1:
            d.line([(start_x + box_w//2, y + box_h), 
                   (start_x + box_w//2, y + box_h + gap)], 
                  fill=stroke, width=2)
    
    # Insight
    if insight:
        iy = 480
        d.rounded_rectangle([100, iy, W-100, iy+50], radius=8,
                           fill="#064e3b", outline=COLORS["emerald"], width=2)
        bbox = d.textbbox((0,0), insight, font=get_font(16))
        tw = bbox[2]-bbox[0]
        d.text((W//2 - tw//2, iy+15), insight, fill=COLORS["emerald"], font=get_font(16))


# ─── Diagram Definitions ─────────────────────────────────────────────────────
# Each post gets a random layout from available styles

posts = [
    {
        "slug": "postfix-opendkim-mail-server",
        "title": "Postfix + OpenDKIM Mail Server",
        "components": [
            ("Local App", "cron · blog", "#083344", COLORS["cyan"]),
            ("Postfix", "null client", "#064e3b", COLORS["emerald"]),
            ("OpenDKIM", "DKIM sign", "#064e3b", COLORS["emerald"]),
            ("SMTP Relay", "TLS auth", "#78350f", COLORS["amber"]),
            ("Inbox", "recipient", "#1e293b", COLORS["slate"]),
        ],
        "insight": "Self-hosted mail: 20% MTA, 80% authentication",
        "layout": None  # Random
    },
    {
        "slug": "deploying-nextjs-nginx",
        "title": "Deploying Next.js + Nginx",
        "components": [
            ("Cloudflare", "CDN + SSL", "#78350f", COLORS["amber"]),
            ("Nginx", "proxy", "#064e3b", COLORS["emerald"]),
            ("Next.js", "standalone", "#083344", COLORS["cyan"]),
            ("PostgreSQL", "database", "#4c1d95", COLORS["violet"]),
            ("Meilisearch", "search", "#064e3b", COLORS["emerald"]),
        ],
        "insight": "Nginx reverse proxy + Cloudflare SSL = production-ready",
        "layout": None
    },
    {
        "slug": "docker-networking-101",
        "title": "Docker Networking 101",
        "components": [
            ("Container A", "port 3000", "#083344", COLORS["cyan"]),
            ("Bridge Net", "default", "#064e3b", COLORS["emerald"]),
            ("Container B", "port 5432", "#4c1d95", COLORS["violet"]),
            ("Host Port", "mapping", "#78350f", COLORS["amber"]),
            ("External", "internet", "#1e293b", COLORS["slate"]),
        ],
        "insight": "Bridges connect containers; host ports expose to world",
        "layout": None
    },
    {
        "slug": "meilisearch-on-docker",
        "title": "Meilisearch on Docker",
        "components": [
            ("User", "browser", "#083344", COLORS["cyan"]),
            ("API Route", "search endpoint", "#064e3b", COLORS["emerald"]),
            ("Meilisearch", "index", "#78350f", COLORS["amber"]),
            ("Results", "instant", "#1e293b", COLORS["slate"]),
        ],
        "insight": "Sub-millisecond search without external dependencies",
        "layout": None
    },
    {
        "slug": "umami-vs-google-analytics",
        "title": "Umami vs Google Analytics",
        "comparison": True,
        "left": [
            ("Data Collection", "third-party", "#78350f", COLORS["amber"]),
            ("Cookie Tracking", "user profiling", "#4c1d95", COLORS["violet"]),
            ("Analytics Dashboard", "cloud-hosted", "#1e293b", COLORS["slate"]),
        ],
        "right": [
            ("Self-Hosted", "your server", "#064e3b", COLORS["emerald"]),
            ("No Cookies", "privacy-first", "#083344", COLORS["cyan"]),
            ("Your Data", "full control", "#064e3b", COLORS["emerald"]),
        ],
        "insight": "Privacy-first analytics: no cookies, no third-party, no tracking",
        "layout": "comparison"
    },
    {
        "slug": "home-lab-proxmox-docker",
        "title": "Home Lab Topology",
        "components": [
            ("Proxmox 1", "192.168.1.110", "#083344", COLORS["cyan"]),
            ("Proxmox 2", "192.168.1.111", "#064e3b", COLORS["emerald"]),
            ("VM: OmniRoute", "AI gateway", "#78350f", COLORS["amber"]),
            ("VM: Hermes", "AI agent", "#4c1d95", COLORS["violet"]),
            ("VM: dockersrv", "containers", "#064e3b", COLORS["emerald"]),
            ("VM: webserver", "blog", "#1e293b", COLORS["slate"]),
        ],
        "insight": "Two hosts, 4 VMs, shared network",
        "layout": "grid"
    },
    {
        "slug": "the-complete-technography-stack",
        "title": "Complete Stack",
        "components": [
            ("Cloudflare", "DNS + SSL", "#78350f", COLORS["amber"]),
            ("Nginx", "proxy", "#064e3b", COLORS["emerald"]),
            ("Next.js", "framework", "#083344", COLORS["cyan"]),
            ("PostgreSQL", "DB", "#4c1d95", COLORS["violet"]),
            ("Meilisearch", "search", "#064e3b", COLORS["emerald"]),
            ("Listmonk", "news", "#78350f", COLORS["amber"]),
        ],
        "insight": "13 posts, 5 services, 0 proprietary deps",
        "layout": "network"
    },
    {
        "slug": "cloudflare-email-routing",
        "title": "Cloudflare Email Routing",
        "components": [
            ("Sender", "external", "#1e293b", COLORS["slate"]),
            ("MX Record", "DNS", "#78350f", COLORS["amber"]),
            ("Cloudflare", "routing", "#083344", COLORS["cyan"]),
            ("Inbox", "delivery", "#064e3b", COLORS["emerald"]),
        ],
        "insight": "Free custom email with Cloudflare's free tier",
        "layout": "pipeline"
    },
    {
        "slug": "deploying-listmonk-newsletter",
        "title": "Deploying Listmonk",
        "components": [
            ("Listmonk", "newsletter", "#064e3b", COLORS["emerald"]),
            ("PostgreSQL", "backend", "#4c1d95", COLORS["violet"]),
            ("SMTP", "delivery", "#78350f", COLORS["amber"]),
            ("Subscribers", "list", "#083344", COLORS["cyan"]),
        ],
        "insight": "Self-hosted newsletter with open source tools",
        "layout": "vertical_stack"
    },
    {
        "slug": "omniroute-hermes-agent",
        "title": "OmniRoute + Hermes",
        "center": "OmniRoute",
        "spokes": [
            ("Hermes", "AI agent", "#083344", COLORS["cyan"]),
            ("DeepSeek", "free tier", "#064e3b", COLORS["emerald"]),
            ("Cloudflare", " Workers", "#78350f", COLORS["amber"]),
            ("200+ Providers", "auto-route", "#4c1d95", COLORS["violet"]),
            ("Cost: $0", "free forever", "#064e3b", COLORS["emerald"]),
        ],
        "insight": "OmniRoute routes to best available free model",
        "layout": "network"
    },
    {
        "slug": "honcho-deep-dive",
        "title": "Honcho Deep Dive",
        "components": [
            ("Honcho API", "memory layer", "#083344", COLORS["cyan"]),
            ("PostgreSQL", "storage", "#4c1d95", COLORS["violet"]),
            ("Hermes", "AI agent", "#064e3b", COLORS["emerald"]),
            ("Sync", "real-time", "#78350f", COLORS["amber"]),
        ],
        "insight": "Honcho gives Hermes persistent memory",
        "layout": "horizontal_flow"
    },
    {
        "slug": "honcho-deep-dive-part-2",
        "title": "Honcho Scaling",
        "components": [
            ("Read Replica", "scale out", "#4c1d95", COLORS["violet"]),
            ("Cache Layer", "Redis", "#78350f", COLORS["amber"]),
            ("Load Balancer", "HAProxy", "#083344", COLORS["cyan"]),
            ("PostgreSQL", "primary", "#064e3b", COLORS["emerald"]),
        ],
        "insight": "Honcho scales with read replicas and pooling",
        "layout": "grid"
    },
    {
        "slug": "how-i-automated-my-devops-with-ai-agent",
        "title": "Automation Pipeline",
        "components": [
            ("Cron", "0 9 * * *", "#78350f", COLORS["amber"]),
            ("AI Agent", "write posts", "#064e3b", COLORS["emerald"]),
            ("GitHub", "commit + push", "#083344", COLORS["cyan"]),
            ("Deploy", "SSH to web", "#064e3b", COLORS["emerald"]),
            ("Verify", "live check", "#78350f", COLORS["amber"]),
        ],
        "insight": "Fully autonomous daily publish pipeline",
        "layout": "pipeline"
    },
]


def generate_diagram(post):
    """Generate a diagram with random or specified layout."""
    W, H = 1200, 600
    img = Image.new('RGB', (W, H), COLORS["bg"])
    d = ImageDraw.Draw(img)
    
    # Title
    bbox = d.textbbox((0,0), post["title"].upper(), font=get_font(26))
    tw = bbox[2]-bbox[0]
    d.text((W//2 - tw//2, 25), post["title"].upper(), fill=COLORS["fg"], font=get_font(26))
    
    # Choose layout
    layout = post.get("layout") or random.choice(LAYOUTS)
    
    if post.get("comparison"):
        draw_comparison(img, d, post["title"], 
                       post.get("left", []), post.get("right", []), post.get("insight"))
    elif layout == "network" and "spokes" in post:
        draw_network(img, d, post["title"], post["center"], post["spokes"], post.get("insight"))
    elif layout == "vertical_stack":
        draw_vertical_stack(img, d, post["title"], post["components"], post.get("insight"))
    elif layout == "comparison":
        draw_comparison(img, d, post["title"], 
                       post.get("left", post["components"][:2]),
                       post.get("right", post["components"][2:]), post.get("insight"))
    elif layout == "grid":
        draw_grid(img, d, post["title"], post["components"], post.get("insight"))
    elif layout == "network":
        draw_network(img, d, post["title"], "Service", post["components"], post.get("insight"))
    elif layout == "pipeline":
        draw_pipeline(img, d, post["title"], post["components"], post.get("insight"))
    else:  # horizontal_flow (default)
        draw_horizontal_flow(img, d, post["title"], post["components"], post.get("insight"))
    
    # Footer
    d.text((W//2, H-25), "Generated for Technography", fill="#475569", font=get_font(14))
    
    # Save
    out = save_diagram(img, post["slug"])
    print(f"  ✓ {post['slug']}: {layout} layout ({os.path.getsize(out)} bytes)")
    return out


if __name__ == "__main__":
    random.seed()  # Fresh seed each run
    print("Regenerating diagrams with varied layouts...")
    for post in posts:
        try:
            generate_diagram(post)
        except Exception as e:
            print(f"  ✗ {post['slug']}: {e}")
    
    print(f"\nDone! {len(posts)} diagrams regenerated with random layouts.")
