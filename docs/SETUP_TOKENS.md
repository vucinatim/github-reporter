# GitHub Reporter - Token Setup Guide

This guide explains how to generate the necessary credentials (`GITHUB_TOKEN`, `SLACK_TOKEN`, etc.) to run the GitHub Reporter.

## 1. Environment Setup

1.  If you haven't already, copy the example environment file:
    ```bash
    cp .env.example .env
    ```
2.  Open `.env` in your editor. You will be pasting the tokens here.

---

## 2. GitHub Token (Required)

You need a **Personal Access Token (Classic)** to fetch data from GitHub.

1.  **Go to Token Settings**:
    *   Navigate to [github.com/settings/tokens](https://github.com/settings/tokens).
    *   *(Or: Settings -> Developer settings -> Personal access tokens -> Tokens (classic))*

2.  **Generate Token**:
    *   Click **Generate new token** -> **Generate new token (classic)**.
    *   **Note**: Name it something like "GitHub Reporter".
    *   **Expiration**: Set an expiration date (or "No expiration" for long-running servers, but be careful).

3.  **Select Scopes**:
    Check the following boxes:
    *   [x] `repo` (Full control of private repositories) - **Required** for private repo access.
    *   [x] `read:org` (Read org and team membership) - **Required** for verifying org access.
    *   [ ] `read:user` (Optional, for user profile data).

4.  **Authorize SSO (CRITICAL for Organizations)**:
    *   If your organization uses SAML Single Sign-On (SSO):
    *   After generating the token, click the **Configure SSO** button next to the new token.
    *   Click **Authorize** for your specific organization.
    *   *If you skip this, the token will fail to access organization resources.*

5.  **Save Credentials**:
    *   Copy the token (starts with `ghp_`).
    *   Paste it into your `.env` file:
        ```env
        GITHUB_TOKEN=ghp_your_token_here
        ```

---

## 3. Slack Integration (Optional)

If you want the reporter to post updates to Slack, you need a Slack App.

### A. Create the App
1.  Go to [api.slack.com/apps](https://api.slack.com/apps).
2.  Click **Create New App**.
3.  Select **From scratch**.
4.  Name it (e.g., "GitHub Reporter") and select your Workspace.

### B. Configure Permissions
1.  In the left sidebar, click **OAuth & Permissions**.
2.  Scroll down to **Scopes** -> **Bot Token Scopes**.
3.  Click **Add an OAuth Scope** and add:
    *   `chat:write` (Required to send messages).
    *   `files:write` (Optional, if uploading stats files).

### C. Install & Get Token
1.  Scroll up to the top of the **OAuth & Permissions** page.
2.  Click **Install to Workspace**.
3.  Accept the permissions.
4.  Copy the **Bot User OAuth Token** (starts with `xoxb-...`).
5.  Paste it into your `.env`:
    ```env
    SLACK_TOKEN=xoxb-your-token-here
    ```

### D. Get Channel ID
1.  Open Slack and right-click the channel you want to post to.
2.  Select **Copy Link**.
3.  The link looks like `https://.../archives/C12345678`.
4.  The ID is the last part: `C12345678`.
5.  Paste it into your `.env`:
    ```env
    SLACK_CHANNEL=C12345678
    ```

### E. Invite the Bot
**Vital Step**: The bot cannot post until it is in the channel.
1.  Go to the Slack channel.
2.  Type `/invite @GitHub Reporter` (or your bot's name).
3.  Press Enter to add the bot.
