#!/usr/bin/env python3
"""Generate the bilingual Hubble Fields user guide PDF.

Requires: pip install reportlab
Fonts: WenQuanYi Micro Hei + Liberation Sans (system packages).

Output: docs/Hubble-Fields-User-Guide-Bilingual.pdf

Layout convention: English on top, Chinese underneath.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_JUSTIFY
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

INK = HexColor("#1A2B34")
TEAL = HexColor("#2A9D8F")
SOFT_TEAL = HexColor("#E6F5F2")
SKY = HexColor("#EAF4F8")
LIGHT = HexColor("#F7FBFC")
MUTED = HexColor("#5B6B73")
LINE = HexColor("#D7E4EA")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

styles = {
    "h1": ParagraphStyle(
        "h1",
        fontName="WQY",
        fontSize=15,
        textColor=INK,
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
        textColor=INK,
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
        textColor=INK,
        leading=14,
        spaceAfter=3,
        leftIndent=8,
    ),
    "toc": ParagraphStyle(
        "toc",
        fontName="WQY",
        fontSize=10,
        textColor=INK,
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
        textColor=INK,
        leading=11,
    ),
}


def body_bi(en: str, zh: str) -> Paragraph:
    """English on top, Chinese underneath."""
    return Paragraph(
        f"{en}<br/><font color='#5B6B73' size='9'>{zh}</font>",
        styles["bilingual"],
    )


def step_bi(index: int, en: str, zh: str) -> Paragraph:
    return Paragraph(
        f"{index}. {en}<br/><font color='#5B6B73'>{zh}</font>",
        styles["step"],
    )


def bullet_bi(en: str, zh: str) -> Paragraph:
    return Paragraph(
        f"• <b>{en}</b><br/><font color='#5B6B73'>&nbsp;&nbsp;&nbsp;{zh}</font>",
        styles["step"],
    )


def note_bi(en: str, zh: str) -> Paragraph:
    return Paragraph(
        f"• {en}<br/>&nbsp;&nbsp;<font color='#5B6B73'>{zh}</font>",
        styles["note"],
    )


def h1(en: str, zh: str) -> KeepTogether:
    return KeepTogether(
        [
            Paragraph(f"{en} / {zh}", styles["h1"]),
            HRFlowable(width="100%", thickness=1, color=LINE, spaceAfter=6),
        ]
    )


def h2(en: str, zh: str) -> Paragraph:
    return Paragraph(f"{en} · {zh}", styles["h2"])


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
    canvas.drawString(MARGIN, 9 * mm, "Hubble Fields")
    canvas.drawRightString(PAGE_W - MARGIN, 9 * mm, f"{doc.page}")
    canvas.restoreState()


def cover_page(canvas, _doc):
    canvas.saveState()
    canvas.setFillColor(SKY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    canvas.setFillColor(SOFT_TEAL)
    canvas.rect(0, PAGE_H * 0.58, PAGE_W, PAGE_H * 0.42, fill=1, stroke=0)

    canvas.setFillColor(TEAL)
    canvas.rect(PAGE_W * 0.28, PAGE_H * 0.46, PAGE_W * 0.44, 2.2, fill=1, stroke=0)

    canvas.setFillColor(TEAL)
    canvas.setFont("WQY", 12)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.62, "HUBBLE FIELDS")

    canvas.setFillColor(INK)
    canvas.setFont("WQY", 20)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.54, "Feature Overview & User Guide")
    canvas.setFont("WQY", 13)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(
        PAGE_W / 2, PAGE_H * 0.49, "工地考勤系统功能介绍与使用指南"
    )

    canvas.setFont("WQY", 10)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(
        PAGE_W / 2, PAGE_H * 0.36, "Bilingual · English / 简体中文"
    )
    canvas.drawCentredString(
        PAGE_W / 2, PAGE_H * 0.32, "Version 0.2 · Field Attendance App"
    )
    canvas.restoreState()


def build_story():
    story = [Spacer(1, 1), PageBreak()]

    story.append(h1("Contents", "目录"))
    for item in [
        "1. Product Overview 产品简介",
        "2. Roles & Permissions 角色与权限",
        "3. Getting Started 快速开始",
        "4. Daily Attendance 日常考勤操作",
        "5. Onsite & History 现场人员与历史",
        "6. Manpower 人力名册",
        "7. Administration 管理功能",
        "8. Settings 设置",
        "9. Platform Console 平台控制台",
        "10. Troubleshooting 常见问题",
    ]:
        story.append(Paragraph(item, styles["toc"]))
    story.append(Spacer(1, 6))
    story.append(
        body_bi(
            "Note: Each section shows English first, then Chinese, so mixed teams can share one document.",
            "说明：每一节先英文、后中文，便于现场中外团队共用同一份文档。",
        )
    )

    # 1
    story.append(h1("1. Product Overview", "1. 产品简介"))
    story.append(
        body_bi(
            "Hubble Fields is a mobile/desktop web attendance app for construction sites. Supervisors check workers in and out with GPS geofence validation and a required site photo, with offline queuing when the network is weak.",
            "Hubble Fields 是面向建筑工地的移动端/桌面端网页考勤系统。现场主管可为工人办理签到与签退，系统记录 GPS 地理围栏状态与现场照片，并支持弱网离线排队同步。",
        )
    )
    story.append(
        body_bi(
            "Platform operators can use the Hubble Fields Platform Console to manage customer companies, projects, and Project Admin accounts.",
            "平台运营侧可使用 Hubble Fields Platform Console 管理客户公司、项目与项目管理员账号。",
        )
    )
    story.append(h2("Key capabilities", "核心能力"))
    for en, zh in [
        (
            "Worker check-in / check-out with GPS + photo",
            "工人签到 / 签退（需 GPS 与现场照片）",
        ),
        ("Live onsite roster and attendance history", "在场名单与考勤历史"),
        ("Manpower directory (ID, company, trade, status)", "人力名册管理"),
        ("Shift-hour reports and CSV export (admin)", "报表与 CSV 导出（管理员）"),
        (
            "Manual punch create / edit for Project Admins",
            "项目管理员手动补录 / 修改打卡时间",
        ),
        ("Invite users and reset temporary passwords", "用户邀请与密码重置"),
        ("Offline punch queue with automatic sync", "离线同步"),
        ("English + Simplified Chinese UI", "中英双语界面"),
    ]:
        story.append(bullet_bi(en, zh))

    # 2
    story.append(h1("2. Roles & Permissions", "2. 角色与权限"))
    story.append(
        body_bi(
            "Menus and actions differ by role. Assign accounts according to job responsibility.",
            "不同角色看到的菜单与可执行操作不同。请按岗位分配账号。",
        )
    )
    story.append(Spacer(1, 4))
    story.append(
        make_table(
            [
                "Role 角色",
                "Check-in 签到",
                "History 历史",
                "Manpower 人力",
                "Reports 报表",
                "Users / Manual",
            ],
            [
                [
                    "Project Admin<br/>项目管理员",
                    "✓",
                    "✓ (92 days)",
                    "Manage 读写",
                    "✓ CSV",
                    "Invite + Manual punch<br/>邀请 + 手动补录",
                ],
                ["Supervisor<br/>主管", "✓", "✓ (14 days)", "Read 只读", "—", "—"],
                ["Safety Officer<br/>安全员", "✓", "✓ (14 days)", "Read 只读", "—", "—"],
                [
                    "Attendance Admin<br/>考勤管理员",
                    "✓",
                    "✓ (14 days)",
                    "Read 只读",
                    "—",
                    "—",
                ],
                [
                    "Project Manager<br/>项目经理",
                    "✓",
                    "✓ (14 days)",
                    "Read 只读",
                    "—",
                    "—",
                ],
                ["Viewer<br/>只读访客", "—", "✓ (14 days)", "Read 只读", "—", "—"],
                [
                    "Platform Admin<br/>平台管理员",
                    "Same as project role<br/>同项目角色",
                    "—",
                    "—",
                    "—",
                    "Console 控制台",
                ],
            ],
            [32 * mm, 24 * mm, 26 * mm, 26 * mm, 22 * mm, 34 * mm],
        )
    )
    story.append(Spacer(1, 6))
    story.append(
        note_bi(
            "Project Admins can invite: Supervisor / Safety Officer / Attendance Admin / Project Manager / Viewer (not another Project Admin from the project app).",
            "项目管理员可邀请上述角色（不能在项目应用内再邀请另一位 Project Admin）。",
        )
    )
    story.append(
        note_bi(
            "Platform admins can open Platform Console (/platform or /console) to create customer companies and Project Admins.",
            "平台管理员可进入 Platform Console（/platform 或 /console）创建客户公司与项目管理员。",
        )
    )

    # 3
    story.append(h1("3. Getting Started", "3. 快速开始"))
    story.append(h2("3.1 Open the sign-in page", "3.1 打开登录页"))
    story.append(
        body_bi(
            "Open the sign-in URL in a phone or desktop browser, e.g. production https://hubblefields.com/signin or local http://localhost:3000/signin. On the same Wi‑Fi you can also use the LAN IP.",
            "在手机或电脑浏览器打开登录地址，例如生产环境：https://hubblefields.com/signin ；本地开发：http://localhost:3000/signin 。同一 Wi‑Fi 下也可用局域网 IP 访问。",
        )
    )
    story.append(h2("3.2 Sign in", "3.2 登录"))
    for i, (en, zh) in enumerate(
        [
            (
                "Enter company email and password, then tap Sign in →.",
                "输入公司邮箱与密码，点击「Sign in →」。",
            ),
            (
                "On first login or temporary password, create a new password (10+ characters, including an uppercase letter and a number).",
                "若为首次登录或临时密码，系统会要求设置新密码（至少 10 位，含大写字母与数字）。",
            ),
            (
                "Temporary passwords expire in 7 days if not changed.",
                "临时密码如未更换，将在 7 天后失效。",
            ),
        ],
        1,
    ):
        story.append(step_bi(i, en, zh))

    story.append(h2("3.3 Forgot password", "3.3 忘记密码"))
    story.append(
        body_bi(
            "There is no self-service reset. Ask a Project Admin to Reset a temporary password under User access.",
            "应用内无自助找回。请联系项目管理员在「User access」中重置临时密码。",
        )
    )

    # 4
    story.append(h1("4. Daily Attendance", "4. 日常考勤操作"))
    story.append(
        body_bi(
            "Supervisors and other check-in roles use Overview to check workers in or out. Every field punch requires GPS location and a site photo.",
            "主管及具备签到权限的角色在「Overview / 首页」办理签到与签退。每次现场打卡必须开启定位并拍摄现场照片。",
        )
    )
    story.append(h2("4.1 Check In", "4.1 签到"))
    for i, (en, zh) in enumerate(
        [
            ("Tap Check In.", "点击「Check In」。"),
            (
                "In WORKER ARRIVAL, search and select a worker (name / last four of ID / trade).",
                "在「WORKER ARRIVAL」中搜索并选择工人（姓名 / 工号后四位 / 工种）。",
            ),
            (
                "Confirm Location shows Location verified · on site. If Outside site, move into the geofence (strict mode blocks off-site punches).",
                "确认 Location：显示 Location verified · on site；若 Outside site，请移动至工地范围内（严格模式下离场将被拒绝）。",
            ),
            (
                "Optionally enter Remarks (max 300 characters).",
                "可选填写 Remarks（最多 300 字）。",
            ),
            (
                "Capture a Site photo (Capture / Album), then Submit check in.",
                "拍摄 Site photo：Capture / Album，确认后 Submit check in。",
            ),
        ],
        1,
    ):
        story.append(step_bi(i, en, zh))

    story.append(h2("4.2 Check Out", "4.2 签退"))
    story.append(
        body_bi(
            "Same flow as check-in via Check Out or Out on the onsite list. A worker must already be onsite to check out; a worker already checked in today cannot check in again.",
            "流程与签到相同，入口为「Check Out」或在场名单中的「Out」。工人须当日已在场才能签退；已签到者不可重复签到。",
        )
    )
    story.append(h2("4.3 Geofence & photo", "4.3 地理围栏与照片"))
    for en, zh in [
        (
            "GPS is always required; allow location in the OS/browser and keep Settings → GPS Location on.",
            "GPS 始终需要；请在系统设置与浏览器中允许定位，并在应用 Settings → GPS Location 保持开启。",
        ),
        (
            "A photo is required; the client compresses images to ≤ 2MB JPEG.",
            "照片为必填，客户端压缩至 ≤ 2MB JPEG。",
        ),
        (
            "Only Active workers can be punched; Inactive workers cannot.",
            "仅 Active 状态工人可被现场打卡；Inactive 不可选。",
        ),
    ]:
        story.append(note_bi(en, zh))

    # 5
    story.append(h1("5. Onsite & History", "5. 现场人员与历史"))
    story.append(h2("5.1 Onsite list", "5.1 在场名单"))
    story.append(
        body_bi(
            "Overview shows the ONSITE count and current workers. Use Out for a quick check-out. Desktop also shows Latest activity.",
            "Overview 显示 ONSITE 人数与在场工人列表。可从列表快速签退（Out）。桌面端可查看 Latest activity。",
        )
    )
    story.append(h2("5.2 Attendance History", "5.2 考勤历史"))
    story.append(
        body_bi(
            "Open Attendance History for recent in/out records. Non-admins typically see up to ~14 days; admin reports can cover up to ~92 days.",
            "导航「Attendance History / 历史」查看近期进出记录。非管理员默认最多约 14 天；管理员报表可查至约 92 天。",
        )
    )
    story.append(
        body_bi(
            "Project Admins also see + Manual punch on History, and Edit on each record row, to backfill or correct punch times.",
            "项目管理员在历史页还可看到「+ Manual punch / 手动补录」，以及每条记录的「Edit / 修改」，用于补录或纠正打卡时间。",
        )
    )

    # 6
    story.append(h1("6. Manpower", "6. 人力名册"))
    story.append(
        body_bi(
            "Manpower lists workers, company, trade, and status (Active / Inactive). All roles can search; only Project Admins can add or activate/deactivate.",
            "「Manpower / 人力」列出工人、公司、工种与状态（Active / Inactive）。所有角色可搜索查看；仅项目管理员可新增与启停。",
        )
    )
    story.append(h2("Project Admin: add a worker", "项目管理员：新增工人"))
    for i, (en, zh) in enumerate(
        [
            ("Tap + Add.", "点击「+ Add」。"),
            (
                "Enter Worker ID (last four digits), Full name, Company, Trade.",
                "填写 Worker ID（后四位）、Full name、Company、Trade。",
            ),
            (
                "After save the worker is Active and can be checked in.",
                "保存后工人状态为 Active，即可被签到。",
            ),
            (
                "Use Deactivate when no longer employed; Activate again if needed.",
                "不再雇佣时使用 Deactivate；需要时可再 Activate。",
            ),
        ],
        1,
    ):
        story.append(step_bi(i, en, zh))

    # 7
    story.append(h1("7. Administration", "7. 管理功能"))
    story.append(
        body_bi(
            "The following are visible only to Project Admins: User access, Reports, and Manual punch / Edit.",
            "以下功能仅 Project Admin 可见：User access（用户权限）、Reports（报表），以及手动补录 / 修改打卡时间。",
        )
    )

    story.append(h2("7.1 User access", "7.1 用户权限"))
    for i, (en, zh) in enumerate(
        [
            (
                "Open ADMINISTRATION → User access.",
                "打开 ADMINISTRATION → User access。",
            ),
            (
                "Tap ＋ Invite, create the account, choose a role, and share the temporary password privately.",
                "点击「＋ Invite」，创建管理账号并选择角色，私下告知临时密码。",
            ),
            (
                "Status may show Active / Temporary password / First login required.",
                "账号状态可能为 Active / Temporary password / First login required。",
            ),
            (
                "If a user forgets the password, tap Reset for a new temporary password (not for other Project Admin rows).",
                "用户忘记密码时，对其点击 Reset 生成新的临时密码（不可重置其他 Project Admin）。",
            ),
        ],
        1,
    ):
        story.append(step_bi(i, en, zh))

    story.append(h2("7.2 Reports & CSV", "7.2 报表与 CSV"))
    for i, (en, zh) in enumerate(
        [
            (
                "Open Reports, set From / To dates, then Run report.",
                "打开 Reports，选择 From / To 日期，点击 Run report。",
            ),
            (
                "Review TOTAL MOVEMENTS, CHECK INS, TOTAL HOURS, plus by-trade, shifts/hours, and movements.",
                "查看 TOTAL MOVEMENTS、CHECK INS、TOTAL HOURS，以及按工种、班次与进出明细。",
            ),
            (
                "Tap CSV to export date/time, worker, ID last 4, company, trade, event, remarks, recorder, GPS, geofence, photo, source (Field/Manual), and shift hours.",
                "点击 CSV 导出：含日期时间、工人、工号后四位、公司、工种、事件、备注、记录人、GPS、围栏结果、照片、来源（Field/Manual）与工时等。",
            ),
        ],
        1,
    ):
        story.append(step_bi(i, en, zh))

    story.append(h2("7.3 Manual punch / edit punch time", "7.3 手动补录 / 修改打卡时间"))
    story.append(
        body_bi(
            "When a worker fails to check in successfully (weak signal, GPS/camera issue, forgotten punch, etc.), a Project Admin can backfill or correct the record without GPS or photo.",
            "当工人未打卡成功（信号弱、定位/拍照异常、漏打卡等），项目管理员可手动补录或修改记录，无需 GPS 与现场照片。",
        )
    )
    story.append(h2("Add a manual punch", "新增手动补录"))
    for i, (en, zh) in enumerate(
        [
            (
                "Open History (or Reports).",
                "打开 History / 历史（或 Reports / 报表）。",
            ),
            (
                "Tap + Manual punch.",
                "点击「+ Manual punch / 手动补录」。",
            ),
            (
                "Select worker, action (Check In / Check Out), punch date & time, and enter a required reason.",
                "选择工人、动作（签到 / 签退）、打卡日期时间，并填写必填原因。",
            ),
            (
                "Save. The record is marked Manual and shows the reason in remarks.",
                "保存。记录会标记为 Manual，原因写入备注。",
            ),
        ],
        1,
    ):
        story.append(step_bi(i, en, zh))

    story.append(h2("Edit an existing punch", "修改已有打卡"))
    for i, (en, zh) in enumerate(
        [
            (
                "On History or Reports, open a record row and tap Edit.",
                "在历史或报表中打开记录行，点击「Edit / 修改」。",
            ),
            (
                "Adjust punch time and/or action, and keep a clear reason for the audit trail.",
                "调整打卡时间和/或动作，并保留清晰原因以便审计。",
            ),
            (
                "Save changes. IN/OUT order for that calendar day is still validated.",
                "保存更改。系统仍会校验该自然日内的签到/签退顺序。",
            ),
        ],
        1,
    ):
        story.append(step_bi(i, en, zh))

    for en, zh in [
        (
            "Only Project Admins can create or edit manual punches.",
            "仅项目管理员可创建或修改手动打卡。",
        ),
        (
            "Lookback is limited to about 92 days; future times are rejected.",
            "可回溯约 92 天；不允许设置未来时间。",
        ),
        (
            "Supervisors continue to use normal field Check In / Out with GPS + photo.",
            "主管仍使用常规现场签到/签退（需 GPS + 照片）。",
        ),
    ]:
        story.append(note_bi(en, zh))

    # 8
    story.append(h1("8. Settings", "8. 设置"))
    story.append(
        body_bi(
            "Settings provides workspace links and preferences.",
            "「Settings / 设置」提供工作区入口与系统偏好。",
        )
    )
    story.append(
        make_table(
            ["Item 项目", "Description 说明"],
            [
                [
                    "History / Manpower / All Projects",
                    "Workspace shortcuts<br/>工作区快捷入口",
                ],
                [
                    "Reports / User access",
                    "Admin-only when permitted<br/>管理员功能（按角色显示）",
                ],
                [
                    "Platform Console",
                    "Platform admin only<br/>仅平台管理员",
                ],
                ["Languages", "English / 简体中文"],
                [
                    "GPS Location",
                    "Required for field punches<br/>现场打卡必须开启",
                ],
                [
                    "Offline Mode",
                    "On by default; queues punches<br/>默认开启；弱网时排队同步",
                ],
                [
                    "Sign Out",
                    "End the 12-hour session<br/>退出登录",
                ],
            ],
            [55 * mm, 109 * mm],
        )
    )
    story.append(Spacer(1, 6))
    story.append(
        body_bi(
            "Offline note: punches are queued locally (pending → uploading → synced / failed) and sync on app start, when online, and every 60 seconds. A banner may show Syncing N offline punch(es)…",
            "离线说明：打卡会写入本地队列（pending → uploading → synced / failed），应用启动、恢复联网及每 60 秒自动同步。界面可能显示「Syncing N offline punch(es)…」。",
        )
    )

    # 9
    story.append(h1("9. Platform Console", "9. 平台控制台"))
    story.append(
        body_bi(
            "Platform admins open Settings → Platform Console, or go to /platform or /console.",
            "平台管理员在 Settings → Platform Console，或直接访问 /platform、/console。",
        )
    )
    for i, (en, zh) in enumerate(
        [
            (
                "Choose company: select or + Add company.",
                "Choose company：选择或 + Add company 新建客户公司。",
            ),
            (
                "Maintain Projects under that company.",
                "维护该公司下的 Projects（项目）。",
            ),
            (
                "Customer Admins: Create admin account for a customer Project Admin.",
                "Customer Admins：Create admin account，为客户创建 Project Admin。",
            ),
            (
                "Share the sign-in URL and temporary password with the customer admin; they then invite supervisors and add manpower.",
                "将登录地址与临时密码交给客户管理员；其登录后邀请现场主管并录入人力。",
            ),
        ],
        1,
    ):
        story.append(step_bi(i, en, zh))

    # 10
    story.append(h1("10. Troubleshooting", "10. 常见问题"))
    story.append(
        make_table(
            ["Issue 问题", "Resolution 处理"],
            [
                [
                    "No GPS / 无法定位",
                    "Enable OS/browser location; turn on GPS Location in Settings.<br/>开启手机定位与浏览器权限；Settings → GPS Location 打开。",
                ],
                [
                    "Outside site blocked",
                    "Move inside the geofence; non-strict mode may still record Off site.<br/>移动至工地围栏内；若非严格模式仍可记录 Off site。",
                ],
                [
                    "Cannot take photo",
                    "Allow camera/photos; a site photo is required for field punches.<br/>允许相机/相册权限；现场打卡照片为必填。",
                ],
                [
                    "Missed field punch",
                    "Ask a Project Admin to add a Manual punch on History.<br/>请项目管理员在历史页使用手动补录。",
                ],
                [
                    "Wrong punch time",
                    "Project Admin: tap Edit on the record and correct time + reason.<br/>项目管理员在记录上点 Edit，改正时间并填写原因。",
                ],
                [
                    "Offline not uploading",
                    "Keep Offline Mode on; wait for auto-sync when online.<br/>保持 Offline Mode；联网后等待自动同步横幅消失。",
                ],
                [
                    "Temporary password expired",
                    "Ask Project Admin to Reset; change password within 7 days.<br/>联系项目管理员 Reset；须在 7 天内首次改密。",
                ],
                [
                    "Signed out / session expired",
                    "Sessions last about 12 hours; sign in again.<br/>会话约 12 小时，请重新登录。",
                ],
                [
                    "Worker not found",
                    "Ensure the worker is Active and the ID/name is correct.<br/>确认 Manpower 中为 Active，且工号/姓名正确。",
                ],
            ],
            [42 * mm, 122 * mm],
        )
    )

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1, color=LINE, spaceAfter=8))
    story.append(
        body_bi(
            "For support, contact your project administrator or platform operator. This guide matches Hubble Fields attendance app v0.2 (includes manual punch).",
            "如需技术支持，请联系项目管理人员或平台运营方。本文档对应 Hubble Fields 考勤应用 v0.2（含手动补录功能）。",
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
        subject="Hubble Fields attendance app user guide",
    )
    doc.build(build_story(), onFirstPage=cover_page, onLaterPages=footer)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
