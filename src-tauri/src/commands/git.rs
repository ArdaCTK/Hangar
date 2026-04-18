use crate::models::{Dependency, GitCommit, ProjectDocs, ApiConnection};
use crate::commands::utils::silent_command;
use std::path::Path;

fn run_git(dir: &Path, args: &[&str]) -> Option<String> {
    let mut cmd = silent_command("git");
    cmd.args(args).current_dir(dir);
    let out = cmd.output().ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        None
    }
}

pub fn get_git_log(project_path: &Path, limit: usize) -> Vec<GitCommit> {
    let raw = run_git(project_path, &["log", &format!("-{}", limit), "--pretty=format:%H|%h|%s|%an|%ci"]);
    let raw = match raw { Some(r) if !r.is_empty() => r, _ => return vec![] };
    raw.lines().filter_map(|line| {
        let parts: Vec<&str> = line.splitn(5, '|').collect();
        if parts.len() < 5 { return None; }
        Some(GitCommit {
            hash: parts[0].to_string(), short_hash: parts[1].to_string(),
            message: parts[2].to_string(), author: parts[3].to_string(), date: parts[4].to_string(),
        })
    }).collect()
}

pub fn get_git_branches(project_path: &Path) -> (Vec<String>, Option<String>) {
    let raw = run_git(project_path, &["branch", "--list"]).unwrap_or_default();
    let mut current = None;
    let mut branches = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("* ") {
            let name = trimmed[2..].trim().to_string();
            current = Some(name.clone()); branches.push(name);
        } else if !trimmed.is_empty() {
            branches.push(trimmed.to_string());
        }
    }
    (branches, current)
}

fn parse_package_json(path: &Path) -> Vec<Dependency> {
    let Ok(raw) = std::fs::read_to_string(path) else { return vec![] };
    let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) else { return vec![] };
    let mut deps = Vec::new();
    for (key, dep_type) in &[("dependencies","dependency"),("devDependencies","devDep"),("peerDependencies","peer")] {
        if let Some(obj) = val.get(*key).and_then(|v| v.as_object()) {
            for (name, version) in obj {
                deps.push(Dependency { name: name.clone(), version: version.as_str().unwrap_or("*").to_string(), dep_type: dep_type.to_string(), ecosystem: "npm".to_string() });
            }
        }
    }
    deps
}

fn parse_cargo_toml(path: &Path) -> Vec<Dependency> {
    let Ok(raw) = std::fs::read_to_string(path) else { return vec![] };
    let Ok(val) = raw.parse::<toml::Value>() else { return vec![] };
    let mut deps = Vec::new();
    for (key, dep_type) in &[("dependencies","dependency"),("dev-dependencies","devDep"),("build-dependencies","build")] {
        if let Some(table) = val.get(*key).and_then(|v| v.as_table()) {
            for (name, value) in table {
                let version = match value {
                    toml::Value::String(s) => s.clone(),
                    toml::Value::Table(t) => t.get("version").and_then(|v| v.as_str()).unwrap_or("*").to_string(),
                    _ => "*".to_string(),
                };
                deps.push(Dependency { name: name.clone(), version, dep_type: dep_type.to_string(), ecosystem: "cargo".to_string() });
            }
        }
    }
    deps
}

fn parse_requirements_txt(path: &Path) -> Vec<Dependency> {
    let Ok(raw) = std::fs::read_to_string(path) else { return vec![] };
    raw.lines().filter(|l| !l.trim().is_empty() && !l.starts_with('#')).map(|l| {
        let l = l.trim();
        if let Some(idx) = l.find(['=', '>', '<', '~']) {
            Dependency { name: l[..idx].trim().to_string(), version: l[idx..].trim().to_string(), dep_type: "dependency".to_string(), ecosystem: "pip".to_string() }
        } else {
            Dependency { name: l.to_string(), version: "*".to_string(), dep_type: "dependency".to_string(), ecosystem: "pip".to_string() }
        }
    }).collect()
}

fn parse_go_mod(path: &Path) -> Vec<Dependency> {
    let Ok(raw) = std::fs::read_to_string(path) else { return vec![] };
    let mut deps = Vec::new();
    let mut in_require = false;
    for line in raw.lines() {
        let t = line.trim();
        if t == "require (" { in_require = true; continue; }
        if t == ")" { in_require = false; continue; }
        let is_single = t.starts_with("require ");
        if in_require || is_single {
            let t = if is_single { &t[8..] } else { t };
            let parts: Vec<&str> = t.split_whitespace().collect();
            if parts.len() >= 2 {
                deps.push(Dependency { name: parts[0].to_string(), version: parts[1].to_string(), dep_type: "dependency".to_string(), ecosystem: "go".to_string() });
            }
        }
    }
    deps
}

pub fn collect_dependencies(project_path: &Path) -> Vec<Dependency> {
    let mut all = Vec::new();
    let pkg = project_path.join("package.json");
    if pkg.exists() { all.extend(parse_package_json(&pkg)); }
    let cargo = project_path.join("Cargo.toml");
    if cargo.exists() { all.extend(parse_cargo_toml(&cargo)); }
    for name in &["requirements.txt","requirements-dev.txt","requirements-test.txt"] {
        let p = project_path.join(name);
        if p.exists() { all.extend(parse_requirements_txt(&p)); }
    }
    let go_mod = project_path.join("go.mod");
    if go_mod.exists() { all.extend(parse_go_mod(&go_mod)); }
    all
}

fn try_read(project_path: &Path, candidates: &[&str]) -> Option<String> {
    for name in candidates {
        let p = project_path.join(name);
        if p.exists() { if let Ok(text) = std::fs::read_to_string(&p) { return Some(text); } }
    }
    None
}

pub fn collect_docs(project_path: &Path) -> ProjectDocs {
    ProjectDocs {
        readme: try_read(project_path, &["README.md","README.MD","readme.md","README.rst","README.txt","README"]),
        license: try_read(project_path, &["LICENSE","LICENSE.md","LICENSE.txt","license","LICENCE"]),
        contributing: try_read(project_path, &["CONTRIBUTING.md","CONTRIBUTING.txt","CONTRIBUTING","contributing.md"]),
        code_of_conduct: try_read(project_path, &["CODE_OF_CONDUCT.md","CODE_OF_CONDUCT.txt","code_of_conduct.md",".github/CODE_OF_CONDUCT.md"]),
    }
}

pub fn detect_api_connections(project_path: &Path) -> Vec<ApiConnection> {
    let mut apis = Vec::new();
    let api_patterns: &[(&str, &str)] = &[
        ("OPENAI_API_KEY","OpenAI / ChatGPT API"),("ANTHROPIC_API_KEY","Anthropic / Claude API"),
        ("GITHUB_TOKEN","GitHub API"),("STRIPE_SECRET_KEY","Stripe Payments"),
        ("FIREBASE_API_KEY","Firebase"),("SUPABASE_URL","Supabase"),("SUPABASE_ANON_KEY","Supabase (Anon Key)"),
        ("DATABASE_URL","Database Connection"),("MONGODB_URI","MongoDB"),("REDIS_URL","Redis"),
        ("AWS_ACCESS_KEY_ID","AWS"),("GOOGLE_API_KEY","Google API"),("DISCORD_TOKEN","Discord Bot"),
        ("SLACK_BOT_TOKEN","Slack Bot"),("SENDGRID_API_KEY","SendGrid Email"),("RESEND_API_KEY","Resend Email"),
        ("CLERK_SECRET_KEY","Clerk Auth"),("NEXTAUTH_SECRET","NextAuth.js"),("JWT_SECRET","JWT Auth"),
        ("MAPBOX_API_KEY","Mapbox Maps"),("CLOUDINARY_URL","Cloudinary Media"),
        ("VITE_API_URL","Vite API Base URL"),("NEXT_PUBLIC_API_URL","Next.js API Base URL"),
        ("API_URL","Generic API Endpoint"),("TAURI_PRIVATE_KEY","Tauri Updater"),
    ];
    let env_files = [".env",".env.local",".env.example",".env.sample",".env.development",".env.production"];
    let mut found_keys: std::collections::HashSet<String> = std::collections::HashSet::new();
    for env_file in &env_files {
        let p = project_path.join(env_file);
        if !p.exists() { continue; }
        let Ok(raw) = std::fs::read_to_string(&p) else { continue };
        for line in raw.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('#') || trimmed.is_empty() { continue; }
            for (pattern, hint) in api_patterns {
                if trimmed.starts_with(pattern) && !found_keys.contains(*pattern) {
                    found_keys.insert(pattern.to_string());
                    apis.push(ApiConnection { key: pattern.to_string(), hint: hint.to_string(), source: env_file.to_string() });
                }
            }
        }
    }
    apis
}

#[tauri::command]
pub fn get_git_log_for_branch(path: String, branch: String, limit: usize) -> Vec<GitCommit> {
    let project_path = Path::new(&path);
    let mut cmd = silent_command("git");
    cmd.args(["log", &branch, &format!("-{}", limit), "--pretty=format:%H|%h|%s|%an|%ci"])
       .current_dir(project_path);
    let Ok(out) = cmd.output() else { return vec![] };
    if !out.status.success() { return vec![]; }
    let raw = String::from_utf8_lossy(&out.stdout);
    raw.lines().filter_map(|line| {
        let parts: Vec<&str> = line.splitn(5, '|').collect();
        if parts.len() < 5 { return None; }
        Some(GitCommit {
            hash: parts[0].to_string(), short_hash: parts[1].to_string(),
            message: parts[2].to_string(), author: parts[3].to_string(), date: parts[4].to_string(),
        })
    }).collect()
}
