# Scripts Directory

## Active Scripts

### Demo Data
- **`seed_demo_by_email.py`** - Seed demo data for a specific user email
- **`seed_demo_for_tenant.py`** - Seed demo data for a tenant

### Utility
- **`reset_password.py`** - Reset user password

## Obsolete Scripts (Removed)

The following scripts are **no longer needed** due to the new file-based skill system:

- ~~`register_unified_pm_os_skills.py`~~ - Skills now loaded from files at runtime
- ~~`import_daily_discipline_skills.py`~~ - Skills now loaded from files at runtime
- ~~`export_local_skills.py`~~ - No longer needed (skills in files, not database)
- ~~`import_database_skills.py`~~ - No longer needed (skills in files, not database)

## Skills Management (New System)

**Skills are now file-based and load automatically at runtime.**

### How It Works
- All 94 skills stored in: `backend/resources/unified-pm-os/skills/*/SKILL.md`
- Loaded automatically when server starts
- Cached in memory for fast access
- No database seeding needed!

### To Add a Skill
1. Create directory: `resources/unified-pm-os/skills/[category]/[skill-name]/`
2. Create `SKILL.md` file with proper format
3. Restart server
4. Done!

### To Modify a Skill
1. Edit the `SKILL.md` file
2. Restart server
3. Done!

### To Remove a Skill
1. Delete the skill directory
2. Restart server
3. Done!

See `../INTELLIGENT_COPILOT.md` for complete documentation on the new intelligent agent system.
