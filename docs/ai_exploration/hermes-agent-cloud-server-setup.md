# Hermes Agent 云服务器配置操作文档

  
适用场景：在一台 Linux 云服务器上长期运行 Hermes Agent，并通过 CLI、Telegram / Discord gateway、cron 定时任务使用它。

这份文档默认使用 Ubuntu 22.04 / 24.04 LTS。其他 Debian 系系统大体类似，但包名和 systemd 行为可能略有差异。

## 部署目标

建议先做一个最小可用版本：

1. Hermes Agent 安装在独立云服务器上。
2. 使用非 root 用户运行。
3. 先让 CLI 对话稳定可用。
4. 再接入 Telegram 或 Discord。
5. 最后把 gateway 装成 systemd 服务，让它重启后自动恢复。
6. 如果需要让 Agent 执行命令，优先使用 Docker terminal backend 做隔离。

不建议一开始就把它装到生产业务服务器上。更稳妥的方式是单独开一台小 VPS，让 Hermes 通过只读 token、SSH 低权限账号、API 或 Docker 环境访问外部资源。

## 推荐服务器规格

官方 README 提到 Hermes 可以跑在低成本 VPS 上。实际使用时，建议按下面的规格选：


| 用途                          | 建议规格                      |
| --------------------------- | ------------------------- |
| 只跑 CLI / Telegram bot       | 1-2 vCPU，2 GB 内存，20 GB 磁盘 |
| 使用 Docker backend、cron、多个平台 | 2 vCPU，4 GB 内存，40 GB 磁盘   |
| 浏览器自动化、语音、本地 STT            | 4 vCPU，8 GB 内存起步          |


如果服务器只有 1-2 GB 内存，建议加 swap，避免安装依赖或跑 Node / browser 工具时 OOM。

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 部署模式选择

### 模式 A：Hermes 直接运行在云服务器上

这是最推荐的方式。

```text
手机 / 电脑
  -> Telegram / Discord
  -> Hermes Gateway on VPS
  -> AIAgent
  -> Docker / local shell / API
```

优点是稳定常驻，不依赖本地电脑。适合个人助手、定时任务、远程巡检。

### 模式 B：本地 Hermes 使用 SSH backend

如果你希望 Hermes 仍然在本地电脑上运行，但命令执行发生在云服务器上，可以使用 SSH backend。

```bash
hermes config set terminal.backend ssh
hermes config set TERMINAL_SSH_HOST <server_ip_or_domain>
hermes config set TERMINAL_SSH_USER hermes
hermes config set TERMINAL_SSH_PORT 22
```

可选变量：

```bash
hermes config set TERMINAL_SSH_KEY ~/.ssh/hermes_vps
hermes config set TERMINAL_SSH_PERSISTENT true
```

这种模式适合“本地聊天，远程执行”。但如果目标是 Telegram / Discord 随时唤起，还是建议用模式 A。

### 模式 C：云服务器上运行 Hermes，命令进入 Docker

这是我最建议的长期形态。

```text
Hermes Gateway on VPS
  -> AIAgent
  -> Docker container
  -> /workspace
```

Hermes 自己运行在服务器用户下，Agent 的终端命令尽量进入 Docker 容器执行。这样即使 Agent 生成了不理想的 shell 命令，也不至于直接污染宿主机。

## 1. 初始化服务器

先用 root 登录云服务器：

```bash
ssh root@<server_ip>
```

更新系统并安装基础工具：

```bash
apt update
apt upgrade -y
apt install -y git curl ca-certificates ufw tmux jq unzip
```

创建专门运行 Hermes 的用户：

```bash
adduser hermes
usermod -aG sudo hermes
```

配置 SSH key。推荐从本地执行：

```bash
ssh-copy-id hermes@<server_ip>
```

如果云厂商只给 root key，也可以在服务器上复制 root 的 authorized_keys：

```bash
mkdir -p /home/hermes/.ssh
cp /root/.ssh/authorized_keys /home/hermes/.ssh/authorized_keys
chown -R hermes:hermes /home/hermes/.ssh
chmod 700 /home/hermes/.ssh
chmod 600 /home/hermes/.ssh/authorized_keys
```

开启基础防火墙：

```bash
ufw allow OpenSSH
ufw enable
ufw status
```

退出 root，改用 `hermes` 用户登录：

```bash
exit
ssh hermes@<server_ip>
```

## 2. 可选：安装 Docker

如果只想先跑 CLI，可以暂时跳过 Docker。长期运行 gateway 时，建议安装。

```bash
sudo apt update
sudo apt install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker hermes
```

重新登录，让用户组生效：

```bash
exit
ssh hermes@<server_ip>
docker run --rm hello-world
```

如果 `hello-world` 能正常输出，说明 Docker 可用。

## 3. 安装 Hermes Agent

官方安装命令如下：

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

如果是更谨慎的服务器，可以先下载脚本审查，再执行：

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh -o install-hermes.sh
less install-hermes.sh
bash install-hermes.sh
```

安装完成后重新加载 shell：

```bash
source ~/.bashrc
```

检查命令是否可用：

```bash
hermes version
hermes doctor
```

官方安装器会把代码放在 `~/.hermes/hermes-agent/`，把数据、配置、密钥、记忆、技能、session 等放在 `~/.hermes/`。

## 4. 配置模型

优先使用交互式配置：

```bash
hermes model
```

根据提示选择 provider 和 model。常见选择：

- OpenRouter：模型多，适合快速试用。
- OpenAI：如果已有 API key 或 Codex / OAuth 路径。
- Anthropic：如果已有 Claude API key 或对应 OAuth 条件。
- Kimi / Moonshot、DeepSeek、DashScope、Gemini：按地区和账号情况选择。
- Custom Endpoint：自建 vLLM、SGLang、Ollama 或其他 OpenAI-compatible 服务。

注意：Hermes 官方要求模型上下文至少 64K token。自建模型要确认 context size 足够，否则多步工具任务很容易失败。

也可以手动写入 key。`hermes config set` 会把密钥类值写进 `~/.hermes/.env`：

```bash
hermes config set OPENROUTER_API_KEY <your_openrouter_key>
hermes config set model <provider/model>
```

检查配置：

```bash
hermes config
hermes doctor
```

## 5. 先验证 CLI

不要一上来就配置 gateway。先确认最基础的对话能跑通：

```bash
hermes chat -q "请用一句话说明你现在可以正常工作。"
```

再测试工具能力：

```bash
hermes chat --toolsets terminal -q "执行 pwd 和 uname -a，然后解释这台机器的大致环境。"
```

测试 session 恢复：

```bash
hermes --continue
```

如果这些都正常，再继续配置 gateway 和 cron。

## 6. 配置 Docker terminal backend

让 Agent 的终端命令尽量进入容器：

```bash
hermes config set terminal.backend docker
```

打开配置文件检查：

```bash
hermes config edit
```

可以按需要补充类似配置：

```yaml
terminal:
  backend: docker
  docker_image: "nikolaik/python-nodejs:python3.11-nodejs20"
  docker_mount_cwd_to_workspace: false
  docker_run_as_host_user: false
  container_cpu: 1
  container_memory: 2048
  container_persistent: true
```

再次测试：

```bash
hermes chat --toolsets terminal -q "执行 pwd、whoami、python --version、node --version，并说明这些命令是否运行在 Docker 环境里。"
```

注意：Docker backend 里的文件和宿主机文件不是天然同一套路径。以后如果需要让 Telegram / Discord 发送 Agent 生成的文件，最好把一个宿主机目录挂进容器，例如：

```yaml
terminal:
  backend: docker
  docker_volumes:
    - "/home/hermes/.hermes/cache/documents:/output"
```

让 Agent 在容器里写 `/output/report.md`，再在回复里使用宿主机可读的 `MEDIA:/home/hermes/.hermes/cache/documents/report.md`。

## 7. 配置 Telegram Gateway

如果你准备用 Telegram 作为入口，先找 BotFather 创建 bot：

1. 在 Telegram 搜索 `@BotFather`。
2. 发送 `/newbot`。
3. 设置 bot 显示名称和 username。
4. 保存 BotFather 返回的 token。

再获取自己的 Telegram user id，可以用 `@userinfobot` 或 `@get_id_bot`。

推荐用官方向导：

```bash
hermes gateway setup
```

选择 Telegram，按提示填入：

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_USERS`

手动配置方式是编辑 `~/.hermes/.env`：

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_ALLOWED_USERS=123456789
```

设置权限：

```bash
chmod 600 ~/.hermes/.env
```

前台启动测试：

```bash
hermes gateway
```

然后给 bot 发一条消息。如果能收到回复，说明 gateway 工作正常。

群聊场景要额外注意：

- Telegram bot 默认 privacy mode 是开启的，群里只能看到命令、回复、服务消息等。
- 如果要让 bot 看见普通群消息，需要在 BotFather 里关闭 privacy mode，并把 bot 移出群再加回。
- 生产使用建议开启 mention 触发，避免群聊里每句话都触发 Agent。
- 始终配置 allowed users，不要把 bot 暴露给所有人。

## 8. 配置 Discord Gateway

Discord 的流程大致是：

1. 去 Discord Developer Portal 创建 Application。
2. 添加 Bot，复制 bot token。
3. 邀请 bot 到服务器。
4. 打开 Discord Developer Mode，复制自己的 Discord User ID。
5. 执行 `hermes gateway setup`，选择 Discord，填 token 和 user id。

手动配置 `~/.hermes/.env` 的基本形式：

```bash
DISCORD_BOT_TOKEN=<your_discord_bot_token>
DISCORD_ALLOWED_USERS=<your_discord_user_id>
```

测试：

```bash
hermes gateway
```

Discord 频道里默认通常需要 `@mention` bot 才会回复，私聊里不需要 mention。这个行为适合大部分团队频道，避免 bot 被普通聊天误触发。

## 9. 安装 gateway 为 systemd 服务

CLI 和 gateway 都跑通后，再做服务化。

### 用户服务

```bash
hermes gateway install
hermes gateway start
hermes gateway status
journalctl --user -u hermes-gateway -f
```

如果希望用户退出 SSH 后服务仍然运行：

```bash
sudo loginctl enable-linger $USER
```

### 系统服务

VPS / headless 服务器更推荐 system service：

```bash
sudo hermes gateway install --system
sudo hermes gateway start --system
sudo hermes gateway status --system
journalctl -u hermes-gateway -f
```

不要同时保留 user service 和 system service，除非你非常清楚自己在做什么。否则 start / stop / status 会变得不直观。

重启服务器验证：

```bash
sudo reboot
```

重新登录后检查：

```bash
hermes gateway status --system
journalctl -u hermes-gateway -n 100 --no-pager
```

## 10. 配置 cron 定时任务

Hermes 的 cron 由 gateway daemon 负责调度，所以必须确保 gateway 在运行。

创建一个简单提醒：

```bash
hermes cron create "every 1h" "检查这台服务器磁盘空间和内存使用情况，如果异常就总结原因。"
```

查看任务：

```bash
hermes cron list
hermes cron status
```

暂停、恢复、手动触发：

```bash
hermes cron pause <job_id>
hermes cron resume <job_id>
hermes cron run <job_id>
```

如果要让任务在某个项目目录中运行：

```bash
hermes cron create "every 1d at 09:00" \
  "总结这个项目最近一天的 git 变更和待处理问题。" \
  --workdir /home/hermes/projects/example
```

建议 cron 任务一开始只做只读检查。需要写文件、发请求、部署服务的任务，应该等权限边界和日志都验证好之后再加。

## 11. 常用运维命令

### 查看状态

```bash
hermes status
hermes doctor
hermes gateway status
hermes cron status
```

### 查看日志

```bash
hermes logs
hermes logs --tail
journalctl -u hermes-gateway -f
```

如果使用 user service：

```bash
journalctl --user -u hermes-gateway -f
```

### 更新 Hermes

先看更新内容：

```bash
hermes update --check
```

更新前备份：

```bash
hermes backup
```

执行更新：

```bash
hermes update --backup
hermes doctor
sudo hermes gateway restart --system
```

如果使用 user service：

```bash
hermes gateway restart
```

### 备份与恢复

官方 CLI 提供备份和导入：

```bash
hermes backup
hermes import <backup_zip>
```

如果手动备份，至少保留：

- `~/.hermes/config.yaml`
- `~/.hermes/.env`
- `~/.hermes/auth.json`
- `~/.hermes/memories/`
- `~/.hermes/skills/`
- `~/.hermes/cron/`
- `~/.hermes/sessions/`

手动打包示例：

```bash
tar --exclude='logs' --exclude='cache' \
  -czf hermes-home-$(date +%F).tar.gz \
  -C ~ .hermes
```

`.env` 和 `auth.json` 可能包含密钥，备份文件要加密保存。

## 12. 安全检查清单

上线前逐项检查：

- Hermes 不是用 root 跑的。
- SSH 使用 key 登录，云服务器安全组只开放必要端口。
- `~/.hermes/.env` 权限是 `600`。
- Telegram / Discord 配了 allowed users。
- gateway 能重启恢复，但不会启动两份。
- terminal backend 如果开启命令执行，优先是 Docker。
- 不长期使用 `--yolo` 或 `approvals.mode: off`。
- cron 任务默认只读，写操作需要单独审查。
- 重要文件有备份，恢复流程至少演练过一次。

## 13. 故障排查


| 问题                           | 可能原因                            | 处理方式                                   |
| ---------------------------- | ------------------------------- | -------------------------------------- |
| `hermes: command not found`  | shell 没刷新或 PATH 没生效             | `source ~/.bashrc`，重新登录 SSH            |
| `hermes doctor` 报 API key 缺失 | provider 没配好                    | 重新执行 `hermes model`                    |
| CLI 能用，Telegram 没反应          | gateway 没运行、token 错、allowlist 错 | `hermes gateway status`，看 `journalctl` |
| Telegram 私聊能用，群里没反应          | privacy mode、群权限、mention 策略     | 检查 BotFather privacy mode，移出重加 bot     |
| Discord bot 离线               | gateway 没启动或 token 错            | 前台跑 `hermes gateway` 看报错               |
| Docker backend 失败            | Docker 未启动或用户没进 docker 组        | `sudo systemctl status docker`，重新登录    |
| cron 没执行                     | gateway 未运行或任务未到时间              | `hermes cron status`，查看 gateway 日志     |
| 账单突然升高                       | cron / background 任务太多，模型太贵     | 检查 `hermes insights` 和 provider 后台     |


## 14. 最小可复制命令

下面是一套从空 Ubuntu 服务器开始的最小命令。真实环境里仍然建议逐步执行并观察输出。

```bash
# root
apt update
apt upgrade -y
apt install -y git curl ca-certificates ufw tmux jq unzip docker.io
adduser hermes
usermod -aG sudo,docker hermes
ufw allow OpenSSH
ufw enable
systemctl enable --now docker
```

```bash
# 本地电脑
ssh-copy-id hermes@<server_ip>
ssh hermes@<server_ip>
```

```bash
# hermes 用户
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
hermes doctor
hermes model
hermes chat -q "请确认 Hermes 已经安装成功。"
hermes config set terminal.backend docker
hermes gateway setup
hermes gateway
```

确认消息平台可用后，再服务化：

```bash
sudo hermes gateway install --system
sudo hermes gateway start --system
sudo hermes gateway status --system
journalctl -u hermes-gateway -f
```

## 参考资料

- [Hermes Agent GitHub README](https://github.com/NousResearch/hermes-agent)
- [Installation](https://hermes-agent.nousresearch.com/docs/getting-started/installation)
- [Quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart)
- [Configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)
- [Messaging Gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging)
- [Telegram Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram/)
- [Discord Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord/)
- [Security](https://hermes-agent.nousresearch.com/docs/user-guide/security)
- [Cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron)
- [CLI Commands Reference](https://hermes-agent.nousresearch.com/docs/reference/cli-commands)

