#!/usr/bin/env python3
"""Generate the bilingual Hubble Fields user guide PDF.

Requires: pip install reportlab
Fonts: WenQuanYi Micro Hei + Liberation Sans (system packages).

Output: docs/Hubble-Fields-User-Guide-Bilingual.pdf
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Hubble-Fields-User-Guide-Bilingual.pdf"

WQY = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
LIB_SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
LIB_SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

pdfmetrics.registerFont(TTFont("WQY", WQY))
pdfmetrics.registerFont(TTFont("LibSans", LIB_SANS))
pdfmetrics.registerFont(TTFont("LibSansBold", LIB_SANS_BOLD))

NAVY = HexColor("#0B1F33")
TEAL = HexColor("#1F6F6A")
ACCENT = HexColor("#C45C26")
LIGHT = HexColor("#F3F6F8")
MUTED = HexColor("#4A5A66")
LINE = HexColor("#D5DEE5")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

styles = {
    "h1": ParagraphStyle(
        "h1",
        fontName="WQY",
        fontSize=15,
        textColor=NAVY,
        spaceBefore=14,
        spaceAfter=8,
        leading=20,
    ),
    "h2": ParagraphStyle(
        "h2",
        fontName="WQY",
        fontSize=12,
        textColor=TEAL,
        spaceBefore=10,
        spaceAfter=5,
        leading=16,
    ),
    "bilingual": ParagraphStyle(
        "bilingual",
        fontName="WQY",
        fontSize=9.5,
        textColor=NAVY,
        leading=14.5,
        spaceAfter=7,
        alignment=TA_JUSTIFY,
    ),
    "note": ParagraphStyle(
        "note",
        fontName="WQY",
        fontSize=9,
        textColor=MUTED,
        leading=13,
        spaceAfter=6,
        leftIndent=4,
    ),
    "step": ParagraphStyle(
        "step",
        fontName="WQY",
        fontSize=9.5,
        textColor=NAVY,
        leading=14,
        spaceAfter=3,
        leftIndent=8,
    ),
    "toc": ParagraphStyle(
        "toc",
        fontName="WQY",
        fontSize=10,
        textColor=NAVY,
        leading=16,
        spaceAfter=3,
    ),
    "th": ParagraphStyle(
        "th",
        fontName="WQY",
        fontSize=8.5,
        textColor=white,
        leading=11,
    ),
    "td": ParagraphStyle(
        "td",
        fontName="WQY",
        fontSize=8.2,
        textColor=NAVY,
        leading=11,
    ),
}


def body_bi(zh: str, en: str) -> Paragraph:
    return Paragraph(
        f"{zh}<br/><font color='#4A5A66' size='9'>{en}</font>",
        styles["bilingual"],
    )


def h1(zh: str, en: str) -> KeepTogether:
    return KeepTogether(
        [
            Paragraph(f"{zh} / {en}", styles["h1"]),
            HRFlowable(width="100%", thickness=1, color=LINE, spaceAfter=6),
        ]
    )


def h2(zh: str, en: str) -> Paragraph:
    return Paragraph(f"{zh} · {en}", styles["h2"])


def make_table(headers, rows, col_widths):
    data = [[Paragraph(h, styles["th"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(c, styles["td"]) for c in row])
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), TEAL),
                ("TEXTCOLOR", (0, 0), (-1, 0), white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, white]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("BOX", (0, 0), (-1, -1), 0.8, TEAL),
            ]
        )
    )
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
    canvas.setFont("WQY", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 9 * mm, "Hubble Fields · QI SHENG CONSTRUCTION")
    canvas.drawRightString(PAGE_W - MARGIN, 9 * mm, f"{doc.page}")
    canvas.restoreState()


def cover_page(canvas, _doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, PAGE_H * 0.42, PAGE_W, 3, fill=1, stroke=0)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, PAGE_H * 0.42 - 6, PAGE_W, 2, fill=1, stroke=0)

    canvas.setFillColor(white)
    canvas.setFont("WQY", 11)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.62, "HUBBLE FIELDS")
    canvas.setFont("WQY", 22)
    canvas.drawCentredString(
        PAGE_W / 2, PAGE_H * 0.55, "工地考勤系统功能介绍与使用指南"
    )
    canvas.setFont("WQY", 13)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.50, "Feature Overview & User Guide")
    canvas.setFont("WQY", 10)
    canvas.setFillColor(HexColor("#A8C0CF"))
    canvas.drawCentredString(
        PAGE_W / 2, PAGE_H * 0.35, "QI SHENG CONSTRUCTION PTE. LTD."
    )
    canvas.drawCentredString(
        PAGE_W / 2, PAGE_H * 0.32, "中英双语 · Bilingual (中文 / English)"
    )
    canvas.drawCentredString(
        PAGE_W / 2, PAGE_H * 0.28, "Version 0.1 · Field Attendance App"
    )
    canvas.restoreState()


def build_story():
    story = [Spacer(1, 1), PageBreak()]

    story.append(h1("目录", "Contents"))
    for item in [
        "1. 产品简介 Product Overview",
        "2. 角色与权限 Roles & Permissions",
        "3. 快速开始 Getting Started",
        "4. 日常考勤操作 Daily Attendance",
        "5. 现场人员与历史 Onsite & History",
        "6. 人力名册 Manpower",
        "7. 管理功能 Administration",
        "8. 设置 Settings",
        "9. 平台控制台 Platform Console",
        "10. 常见问题 Troubleshooting",
    ]:
        story.append(Paragraph(item, styles["toc"]))
    story.append(Spacer(1, 6))
    story.append(
        body_bi(
            "说明：每一节同时提供中文与英文，便于现场中外团队共用同一份文档。",
            "Note: Each section includes Chinese and English so mixed teams can share one document.",
        )
    )

    story.append(h1("1. 产品简介", "1. Product Overview"))
    story.append(
        body_bi(
            "Hubble Fields 是面向建筑工地的移动端/桌面端网页考勤系统。现场主管可为工人办理签到与签退，系统记录 GPS 地理围栏状态与现场照片，并支持弱网离线排队同步。",
            "Hubble Fields is a mobile/desktop web attendance app for construction sites. Supervisors check workers in and out with GPS geofence validation and a required site photo, with offline queuing when the network is weak.",
        )
    )
    story.append(
        body_bi(
            "现场品牌展示为 QI SHENG CONSTRUCTION PTE. LTD.；平台运营侧使用 Hubble Fields Platform Console 管理客户公司、项目与项目管理员账号。",
            "The on-site brand shown in the app is QI SHENG CONSTRUCTION PTE. LTD. Platform operators use the Hubble Fields Platform Console to manage customer companies, projects, and Project Admin accounts.",
        )
    )
    story.append(h2("核心能力", "Key capabilities"))
    for zh, en in [
        ("工人签到 / 签退", "Worker check-in / check-out with GPS + photo"),
        ("在场名单与考勤历史", "Live onsite roster and attendance history"),
        ("人力名册管理", "Manpower directory (ID, company, trade, status)"),
        ("报表与 CSV 导出", "Shift-hour reports and CSV export (admin)"),
        ("用户邀请与密码重置", "Invite users and reset temporary passwords"),
        ("离线同步", "Offline punch queue with automatic sync"),
        ("中英双语界面", "English + Simplified Chinese UI"),
    ]:
        story.append(
            Paragraph(
                f"• <b>{zh}</b> — <font color='#4A5A66'>{en}</font>",
                styles["step"],
            )
        )

    story.append(h1("2. 角色与权限", "2. Roles & Permissions"))
    story.append(
        body_bi(
            "不同角色看到的菜单与可执行操作不同。请按岗位分配账号。",
            "Menus and actions differ by role. Assign accounts according to job responsibility.",
        )
    )
    story.append(Spacer(1, 4))
    story.append(
        make_table(
            [
                "角色 Role",
                "签到 Check-in",
                "历史 History",
                "人力 Manpower",
                "报表 Reports",
                "用户 Users",
            ],
            [
                [
                    "Project Admin<br/>项目管理员",
                    "✓",
                    "✓ (92天)",
                    "读写 Manage",
                    "✓ CSV",
                    "邀请/重置",
                ],
                ["Supervisor<br/>主管", "✓", "✓ (14天)", "只读 Read", "—", "—"],
                ["Safety Officer<br/>安全员", "✓", "✓ (14天)", "只读 Read", "—", "—"],
                [
                    "Attendance Admin<br/>考勤管理员",
                    "✓",
                    "✓ (14天)",
                    "只读 Read",
                    "—",
                    "—",
                ],
                [
                    "Project Manager<br/>项目经理",
                    "✓",
                    "✓ (14天)",
                    "只读 Read",
                    "—",
                    "—",
                ],
                ["Viewer<br/>只读访客", "—", "✓ (14天)", "只读 Read", "—", "—"],
                [
                    "Platform Admin<br/>平台管理员",
                    "同项目角色",
                    "—",
                    "—",
                    "—",
                    "控制台 Console",
                ],
            ],
            [32 * mm, 24 * mm, 28 * mm, 28 * mm, 24 * mm, 28 * mm],
        )
    )
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "• 项目管理员可邀请：Supervisor / Safety Officer / Attendance Admin / Project Manager / Viewer。<br/>"
            "• Project Admins can invite the roles above (not another Project Admin from the project app).<br/>"
            "• 平台管理员可进入 Platform Console（/platform 或 /console）创建客户公司与项目管理员。",
            styles["note"],
        )
    )

    story.append(h1("3. 快速开始", "3. Getting Started"))
    story.append(h2("3.1 打开登录页", "3.1 Open the sign-in page"))
    story.append(
        body_bi(
            "在手机或电脑浏览器打开登录地址，例如生产环境：https://hubblefields.com/signin ；本地开发：http://localhost:3000/signin 。同一 Wi‑Fi 下也可用局域网 IP 访问。",
            "Open the sign-in URL in a phone or desktop browser, e.g. production https://hubblefields.com/signin or local http://localhost:3000/signin. On the same Wi‑Fi you can also use the LAN IP.",
        )
    )
    story.append(h2("3.2 登录", "3.2 Sign in"))
    for i, (zh, en) in enumerate(
        [
            (
                "输入公司邮箱与密码，点击「Sign in →」。",
                "Enter company email and password, then tap Sign in →.",
            ),
            (
                "若为首次登录或临时密码，系统会要求设置新密码（至少 10 位，含大写字母与数字）。",
                "On first login or temporary password, create a new password (10+ characters, including an uppercase letter and a number).",
            ),
            (
                "临时密码如未更换，将在 7 天后失效。",
                "Temporary passwords expire in 7 days if not changed.",
            ),
        ],
        1,
    ):
        story.append(
            Paragraph(
                f"{i}. {zh}<br/><font color='#4A5A66'>{en}</font>",
                styles["step"],
            )
        )

    story.append(h2("3.3 忘记密码", "3.3 Forgot password"))
    story.append(
        body_bi(
            "应用内无自助找回。请联系项目管理员在「User access」中重置临时密码。种子管理员可由运维执行 npm run db:reset-admin。",
            "There is no self-service reset. Ask a Project Admin to Reset a temporary password under User access. For the seed admin, ops may run npm run db:reset-admin.",
        )
    )

    story.append(h1("4. 日常考勤操作", "4. Daily Attendance"))
    story.append(
        body_bi(
            "主管及具备签到权限的角色在「Overview / 首页」办理签到与签退。每次打卡必须开启定位并拍摄现场照片。",
            "Supervisors and other check-in roles use Overview to check workers in or out. Every punch requires GPS location and a site photo.",
        )
    )
    story.append(h2("4.1 签到 Check In", "4.1 Check In"))
    for i, (zh, en) in enumerate(
        [
            ("点击「Check In」。", "Tap Check In."),
            (
                "在「WORKER ARRIVAL」中搜索并选择工人（姓名 / 工号后四位 / 工种）。",
                "In WORKER ARRIVAL, search and select a worker (name / last four of ID / trade).",
            ),
            (
                "确认 Location：显示 Location verified · on site；若 Outside site，请移动至工地范围内（严格模式下离场将被拒绝）。",
                "Confirm Location shows Location verified · on site. If Outside site, move into the geofence (strict mode blocks off-site punches).",
            ),
            (
                "可选填写 Remarks（最多 300 字）。",
                "Optionally enter Remarks (max 300 characters).",
            ),
            (
                "拍摄 Site photo：Capture / Album，确认后 Submit check in。",
                "Capture a Site photo (Capture / Album), then Submit check in.",
            ),
        ],
        1,
    ):
        story.append(
            Paragraph(
                f"{i}. {zh}<br/><font color='#4A5A66'>{en}</font>",
                styles["step"],
            )
        )

    story.append(h2("4.2 签退 Check Out", "4.2 Check Out"))
    story.append(
        body_bi(
            "流程与签到相同，入口为「Check Out」或在场名单中的「Out」。工人须当日已在场才能签退；已签到者不可重复签到。",
            "Same flow as check-in via Check Out or Out on the onsite list. A worker must already be onsite to check out; a worker already checked in today cannot check in again.",
        )
    )
    story.append(h2("4.3 地理围栏与照片", "4.3 Geofence & photo"))
    story.append(
        Paragraph(
            "• GPS 始终需要；请在系统设置与浏览器中允许定位，并在应用 Settings → GPS Location 保持开启。<br/>"
            "• GPS is always required; allow location in the OS/browser and keep Settings → GPS Location on.<br/>"
            "• 照片为必填，客户端压缩至 ≤ 2MB JPEG。<br/>"
            "• A photo is required; the client compresses images to ≤ 2MB JPEG.<br/>"
            "• 仅 Active 状态工人可被打卡；Inactive 不可选。<br/>"
            "• Only Active workers can be punched; Inactive workers cannot.",
            styles["note"],
        )
    )

    story.append(h1("5. 现场人员与历史", "5. Onsite & History"))
    story.append(h2("5.1 在场名单 Onsite", "5.1 Onsite list"))
    story.append(
        body_bi(
            "Overview 显示 ONSITE 人数与在场工人列表。可从列表快速签退（Out）。桌面端可查看 Latest activity。",
            "Overview shows the ONSITE count and current workers. Use Out for a quick check-out. Desktop also shows Latest activity.",
        )
    )
    story.append(h2("5.2 考勤历史", "5.2 Attendance History"))
    story.append(
        body_bi(
            "导航「Attendance History / 历史」查看近期进出记录。非管理员默认最多约 14 天；管理员报表可查至约 92 天。",
            "Open Attendance History for recent in/out records. Non-admins typically see up to ~14 days; admin reports can cover up to ~92 days.",
        )
    )

    story.append(h1("6. 人力名册", "6. Manpower"))
    story.append(
        body_bi(
            "「Manpower / 人力」列出工人、公司、工种与状态（Active / Inactive）。所有角色可搜索查看；仅项目管理员可新增与启停。",
            "Manpower lists workers, company, trade, and status (Active / Inactive). All roles can search; only Project Admins can add or activate/deactivate.",
        )
    )
    story.append(h2("项目管理员：新增工人", "Project Admin: add a worker"))
    for i, (zh, en) in enumerate(
        [
            ("点击「+ Add」。", "Tap + Add."),
            (
                "填写 Worker ID（后四位）、Full name、Company、Trade。",
                "Enter Worker ID (last four digits), Full name, Company, Trade.",
            ),
            (
                "保存后工人状态为 Active，即可被签到。",
                "After save the worker is Active and can be checked in.",
            ),
            (
                "不再雇佣时使用 Deactivate；需要时可再 Activate。",
                "Use Deactivate when no longer employed; Activate again if needed.",
            ),
        ],
        1,
    ):
        story.append(
            Paragraph(
                f"{i}. {zh}<br/><font color='#4A5A66'>{en}</font>",
                styles["step"],
            )
        )

    story.append(h1("7. 管理功能", "7. Administration"))
    story.append(
        body_bi(
            "以下功能仅 Project Admin 可见：User access（用户权限）与 Reports（报表）。",
            "The following are visible only to Project Admins: User access and Reports.",
        )
    )
    story.append(h2("7.1 用户权限 User access", "7.1 User access"))
    for i, (zh, en) in enumerate(
        [
            (
                "打开 ADMINISTRATION → User access。",
                "Open ADMINISTRATION → User access.",
            ),
            (
                "点击「＋ Invite」，创建管理账号并选择角色，私下告知临时密码。",
                "Tap ＋ Invite, create the account, choose a role, and share the temporary password privately.",
            ),
            (
                "账号状态可能为 Active / Temporary password / First login required。",
                "Status may show Active / Temporary password / First login required.",
            ),
            (
                "用户忘记密码时，对其点击 Reset 生成新的临时密码（不可重置其他 Project Admin）。",
                "If a user forgets the password, tap Reset for a new temporary password (not for other Project Admin rows).",
            ),
        ],
        1,
    ):
        story.append(
            Paragraph(
                f"{i}. {zh}<br/><font color='#4A5A66'>{en}</font>",
                styles["step"],
            )
        )

    story.append(h2("7.2 报表与 CSV", "7.2 Reports & CSV"))
    for i, (zh, en) in enumerate(
        [
            (
                "打开 Reports，选择 From / To 日期，点击 Run report。",
                "Open Reports, set From / To dates, then Run report.",
            ),
            (
                "查看 TOTAL MOVEMENTS、CHECK INS、TOTAL HOURS，以及按工种、班次与进出明细。",
                "Review TOTAL MOVEMENTS, CHECK INS, TOTAL HOURS, plus by-trade, shifts/hours, and movements.",
            ),
            (
                "点击 CSV 导出：含日期时间、工人、工号后四位、公司、工种、事件、备注、记录人、GPS、围栏结果、照片与工时等。",
                "Tap CSV to export date/time, worker, ID last 4, company, trade, event, remarks, recorder, GPS, geofence, photo, and shift hours.",
            ),
        ],
        1,
    ):
        story.append(
            Paragraph(
                f"{i}. {zh}<br/><font color='#4A5A66'>{en}</font>",
                styles["step"],
            )
        )

    story.append(h1("8. 设置", "8. Settings"))
    story.append(
        body_bi(
            "「Settings / 设置」提供工作区入口与系统偏好。",
            "Settings provides workspace links and preferences.",
        )
    )
    story.append(
        make_table(
            ["项目 Item", "说明 Description"],
            [
                [
                    "History / Manpower / All Projects",
                    "工作区快捷入口 Workspace shortcuts",
                ],
                [
                    "Reports / User access",
                    "管理员功能（按角色显示） Admin-only when permitted",
                ],
                ["Platform Console", "仅平台管理员 Platform admin only"],
                ["Languages", "English / 简体中文"],
                ["GPS Location", "必须开启以完成打卡 Required for punches"],
                [
                    "Offline Mode",
                    "默认开启；弱网时排队同步 On by default; queues punches",
                ],
                ["Sign Out", "退出登录 End the 12-hour session"],
            ],
            [55 * mm, 109 * mm],
        )
    )
    story.append(Spacer(1, 6))
    story.append(
        body_bi(
            "离线说明：打卡会写入本地队列（pending → uploading → synced / failed），应用启动、恢复联网及每 60 秒自动同步。界面可能显示「Syncing N offline punch(es)…」。",
            "Offline note: punches are queued locally (pending → uploading → synced / failed) and sync on app start, when online, and every 60 seconds. A banner may show Syncing N offline punch(es)…",
        )
    )

    story.append(h1("9. 平台控制台", "9. Platform Console"))
    story.append(
        body_bi(
            "平台管理员在 Settings → Platform Console，或直接访问 /platform、/console。",
            "Platform admins open Settings → Platform Console, or go to /platform or /console.",
        )
    )
    for i, (zh, en) in enumerate(
        [
            (
                "Choose company：选择或 + Add company 新建客户公司。",
                "Choose company: select or + Add company.",
            ),
            (
                "维护该公司下的 Projects（项目）。",
                "Maintain Projects under that company.",
            ),
            (
                "Customer Admins：Create admin account，为客户创建 Project Admin。",
                "Customer Admins: Create admin account for a customer Project Admin.",
            ),
            (
                "将登录地址与临时密码交给客户管理员；其登录后邀请现场主管并录入人力。",
                "Share the sign-in URL and temporary password with the customer admin; they then invite supervisors and add manpower.",
            ),
        ],
        1,
    ):
        story.append(
            Paragraph(
                f"{i}. {zh}<br/><font color='#4A5A66'>{en}</font>",
                styles["step"],
            )
        )

    story.append(h1("10. 常见问题", "10. Troubleshooting"))
    story.append(
        make_table(
            ["问题 Issue", "处理 Resolution"],
            [
                [
                    "无法定位 / No GPS",
                    "开启手机定位与浏览器权限；Settings → GPS Location 打开。Enable OS/browser location; turn on GPS Location in Settings.",
                ],
                [
                    "Outside site 无法提交",
                    "移动至工地围栏内；若非严格模式仍可记录 Off site。Move inside the geofence; non-strict mode may still record Off site.",
                ],
                [
                    "无法拍照",
                    "允许相机/相册权限；照片为必填。Allow camera/photos; a site photo is required.",
                ],
                [
                    "离线未上传",
                    "保持 Offline Mode；联网后等待自动同步横幅消失。Keep Offline Mode on; wait for auto-sync when online.",
                ],
                [
                    "临时密码失效",
                    "联系项目管理员 Reset；须在 7 天内首次改密。Ask Project Admin to Reset; change password within 7 days.",
                ],
                [
                    "会话过期 Signed out",
                    "会话约 12 小时，请重新登录。Sessions last about 12 hours; sign in again.",
                ],
                [
                    "工人搜不到",
                    "确认 Manpower 中为 Active，且工号/姓名正确。Ensure the worker is Active and the ID/name is correct.",
                ],
            ],
            [42 * mm, 122 * mm],
        )
    )

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1, color=LINE, spaceAfter=8))
    story.append(
        body_bi(
            "如需技术支持，请联系项目管理人员或平台运营方。本文档对应 Hubble Fields 考勤应用 v0.1。",
            "For support, contact your project administrator or platform operator. This guide matches Hubble Fields attendance app v0.1.",
        )
    )
    return story


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="Hubble Fields — Feature Overview & User Guide (Bilingual)",
        author="Hubble Fields",
        subject="QI SHENG CONSTRUCTION attendance app user guide",
    )
    doc.build(build_story(), onFirstPage=cover_page, onLaterPages=footer)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
