---
title: "Personal Cloud with Nextcloud: Docker Compose Setup"
date: "2026-08-23"
excerpt: "Learn how to deploy your own personal cloud storage solution using Nextcloud and Docker Compose for full data sovereignty."
tags: ["nextcloud", "self-hosting", "docker", "cloud"]
---

# Personal Cloud with Nextcloud: Docker Compose Setup

In an era where data privacy is paramount, hosting your own cloud storage is a powerful step toward reclaiming your digital sovereignty. Nextcloud is the industry-standard, open-source platform that brings you a suite of collaboration tools, including file storage, calendar, contacts, and much more, all running on your own infrastructure.

In this guide, we will walk through setting up Nextcloud using Docker Compose.

## Prerequisites

- A server running Docker and Docker Compose (e.g., `<YOUR_SERVER>`).
- Basic knowledge of YAML and terminal commands.
- A domain name (e.g., `<YOUR_DOMAIN>`) pointing to your server.
- A reverse proxy (like Nginx) configured on `<YOUR_SERVER>`.

## The Docker Compose Configuration

Create a directory for your Nextcloud setup and define your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  db:
    image: mariadb:10.6
    restart: always
    command: --transaction-isolation=READ-COMMITTED --binlog-format=ROW
    volumes:
      - db_data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=secure_root_password
      - MYSQL_PASSWORD=nextcloud_db_password
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud

  app:
    image: nextcloud:latest
    restart: always
    ports:
      - "8080:80"
    links:
      - db
    volumes:
      - nextcloud_data:/var/www/html
    environment:
      - MYSQL_PASSWORD=nextcloud_db_password
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_HOST=db
    depends_on:
      - db

volumes:
  db_data:
  nextcloud_data:
```

*Note: Replace `secure_root_password` and `nextcloud_db_password` with strong, unique passwords stored securely.*

## Deployment

Deploy the stack with:

```bash
docker-compose up -d
```

## Configuring the Reverse Proxy

To make Nextcloud accessible via `<YOUR_DOMAIN>`, configure your reverse proxy (e.g., Nginx) to forward traffic from `https://<YOUR_DOMAIN>` to the local port `8080` where the application is listening.

## Finalizing Setup

Navigate to your domain in a web browser. Nextcloud will prompt you to create an administrator account and connect to the database defined in your `docker-compose.yml`.

By following these steps, you have successfully deployed a robust, self-hosted personal cloud. Remember to configure regular backups for both the database and the file directory!
