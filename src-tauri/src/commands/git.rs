use crate::models::{Dependency, GitCommit, ProjectDocs, ApiConnection};
use std::path::Path;
use std::process::Command;

// ── Git Helpers ───────────────────────────────────────────────────────────────

fn run_git(dir: &Path, args: &[&str]) -> Option<String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        None
    }
}

pub fn get_git_log(project_path: &Path, limit: usize) -> Vec<GitCommit> {
    let limit_str = limit.to_string();
    let raw = run_git(
        project_path,
        &[
            "log",
            &format!("-{}", limit_str),
            "--pretty=format:%H|%h|%s|%an|%ci",
        ],
    );

    let raw = match raw {
        Some(r) if !r.is_empty() => r,
        _ => return vec![],
    };

    raw.lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(5, '|').collect();
            if parts.len() < 5 { return None; }
            Some(GitCommit {
                hash:       parts[0].to_string(),
                short_hash: parts[1].to_string(),
                message:    parts[2].to_string(),
                author:     parts[3].to_string(),
                date:       parts[4].to_string(),
            })
        })
        .collect()
}

pub fn get_git_branches(project_path: &Path) -> (Vec<String>, Option<String>) {
    let raw = run_git(project_path, &["branch", "--list"]);
    let raw = raw.unwrap_or_default();

    let mut current = None;
    let mut branches = Vec::new();

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("* ") {
            let name = trimmed[2..].trim().to_string();
            current = Some(name.clone());
            branches.push(name);
        } else if !trimmed.is_empty() {
            branches.push(trimmed.to_string());
        }
    }

    (branches, current)
}

// ── Dependency Parsers ────────────────────────────────────────────────────────

fn parse_package_json(path: &Path) -> Vec<Dependency> {
    let raw = match std::fs::read_to_string(path) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let val: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let mut deps = Vec::new();

    let sections: &[(&str, &str)] = &[
        ("dependencies",    "dependency"),
        ("devDependencies", "devDep"),
        ("peerDependencies","peer"),
    ];

    for (key, dep_type) in sections {
        if let Some(obj) = val.get(*key).and_then(|v| v.as_object()) {
            for (name, version) in obj {
                deps.push(Dependency {
                    name: name.clone(),
                    version: version.as_str().unwrap_or("*").to_string(),
                    dep_type: dep_type.to_string(),
                    ecosystem: "npm".to_string(),
                });
            }
        }
    }
    deps
}

fn parse_cargo_toml(path: &Path) -> Vec<Dependency> {
    let raw = match std::fs::read_to_string(path) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let val: toml::Value = match raw.parse() {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let mut deps = Vec::new();

    let sections: &[(&str, &str)] = &[
        ("dependencies",     "dependency"),
        ("dev-dependencies", "devDep"),
        ("build-dependencies", "build"),
    ];

    for (key, dep_type) in sections {
        if let Some(table) = val.get(*key).and_then(|v| v.as_table()) {
            for (name, value) in table {
                let version = match value {
                    toml::Value::String(s) => s.clone(),
                    toml::Value::Table(t) => t
                        .get("version")
                        .and_then(|v| v.as_str())
                        .unwrap_or("*")
                        .to_string(),
                    _ => "*".to_string(),
                };
                deps.push(Dependency {
                    name: name.clone(),
                    version,
                    dep_type: dep_type.to_string(),
                    ecosystem: "cargo".to_string(),
                });
            }
        }
    }
    deps
}

fn parse_requirements_txt(path: &Path) -> Vec<Dependency> {
    let raw = match std::fs::read_to_string(path) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    raw.lines()
        .filter(|l| !l.trim().is_empty() && !l.starts_with('#'))
        .map(|l| {
            let l = l.trim();
            if let Some(idx) = l.find(['=', '>', '<', '~']) {
                Dependency {
                    name:      l[..idx].trim().to_string(),
                    version:   l[idx..].trim().to_string(),
                    dep_type:  "dependency".to_string(),
                    ecosystem: "pip".to_string(),
                }
            } else {
                Dependency {
                    name:      l.to_string(),
                    version:   "*".to_string(),
                    dep_type:  "dependency".to_string(),
                    ecosystem: "pip".to_string(),
                }
            }
        })
        .collect()
}

fn parse_go_mod(path: &Path) -> Vec<Dependency> {
    let raw = match std::fs::read_to_string(path) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let mut deps = Vec::new();
    let mut in_require = false;

    for line in raw.lines() {
        let t = line.trim();
        if t == "require (" { in_require = true; continue; }
        if t == ")"         { in_require = false; continue; }

        let is_single = t.starts_with("require ");
        if in_require || is_single {
            let t = if is_single { &t[8..] } else { t };
            let parts: Vec<&str> = t.split_whitespace().collect();
            if parts.len() >= 2 {
                deps.push(Dependency {
                    name:      parts[0].to_string(),
                    version:   parts[1].to_string(),
                    dep_type:  "dependency".to_string(),
                    ecosystem: "go".to_string(),
                });
            }
        }
    }
    deps
}

pub fn collect_dependencies(project_path: &Path) -> Vec<Dependency> {
    let mut all = Vec::new();

    // npm/yarn/pnpm
    let pkg = project_path.join("package.json");
    if pkg.exists() { all.extend(parse_package_json(&pkg)); }

    // Cargo
    let cargo = project_path.join("Cargo.toml");
    if cargo.exists() { all.extend(parse_cargo_toml(&cargo)); }

    // Python
    for name in &["requirements.txt", "requirements-dev.txt", "requirements-test.txt"] {
        let p = project_path.join(name);
        if p.exists() { all.extend(parse_requirements_txt(&p)); }
    }

    // Go
    let go_mod = project_path.join("go.mod");
    if go_mod.exists() { all.extend(parse_go_mod(&go_mod)); }

    all
}

// ── Project Docs ──────────────────────────────────────────────────────────────

fn try_read(project_path: &Path, candidates: &[&str]) -> Option<String> {
    for name in candidates {
        let p = project_path.join(name);
        if p.exists() {
            if let Ok(text) = std::fs::read_to_string(&p) {
                return Some(text);
            }
        }
    }
    None
}

pub fn collect_docs(project_path: &Path) -> ProjectDocs {
    ProjectDocs {
        readme: try_read(project_path, &[
            "README.md", "README.MD", "readme.md",
            "README.rst", "README.txt", "README",
        ]),
        license: try_read(project_path, &[
            "LICENSE", "LICENSE.md", "LICENSE.txt",
            "license", "license.md", "LICENCE",
        ]),
        contributing: try_read(project_path, &[
            "CONTRIBUTING.md", "CONTRIBUTING.txt", "CONTRIBUTING",
            "contributing.md",
        ]),
        code_of_conduct: try_read(project_path, &[
            "CODE_OF_CONDUCT.md", "CODE_OF_CONDUCT.txt",
            "code_of_conduct.md", ".github/CODE_OF_CONDUCT.md",
        ]),
    }
}

// ── API Connections ───────────────────────────────────────────────────────────

pub fn detect_api_connections(project_path: &Path) -> Vec<ApiConnection> {
    let mut apis = Vec::new();

    // Common env var patterns that indicate API usage
    let api_patterns: &[(&str, &str)] = &[
        ("OPENAI_API_KEY",          "OpenAI / ChatGPT API"),
        ("ANTHROPIC_API_KEY",       "Anthropic / Claude API"),
        ("GITHUB_TOKEN",            "GitHub API"),
        ("GITHUB_API_KEY",          "GitHub API"),
        ("STRIPE_SECRET_KEY",       "Stripe Payments"),
        ("STRIPE_PUBLISHABLE_KEY",  "Stripe Payments (Public)"),
        ("FIREBASE_API_KEY",        "Firebase"),
        ("SUPABASE_URL",            "Supabase"),
        ("SUPABASE_ANON_KEY",       "Supabase (Anon Key)"),
        ("DATABASE_URL",            "Database Connection"),
        ("MONGODB_URI",             "MongoDB"),
        ("REDIS_URL",               "Redis"),
        ("AWS_ACCESS_KEY_ID",       "AWS"),
        ("AWS_SECRET_ACCESS_KEY",   "AWS (Secret)"),
        ("GOOGLE_API_KEY",          "Google API"),
        ("GOOGLE_CLIENT_ID",        "Google OAuth"),
        ("DISCORD_TOKEN",           "Discord Bot"),
        ("DISCORD_CLIENT_ID",       "Discord OAuth"),
        ("SLACK_BOT_TOKEN",         "Slack Bot"),
        ("TWILIO_ACCOUNT_SID",      "Twilio SMS/Voice"),
        ("SENDGRID_API_KEY",        "SendGrid Email"),
        ("RESEND_API_KEY",          "Resend Email"),
        ("CLERK_SECRET_KEY",        "Clerk Auth"),
        ("NEXTAUTH_SECRET",         "NextAuth.js"),
        ("JWT_SECRET",              "JWT Auth"),
        ("PUSHER_APP_KEY",          "Pusher Realtime"),
        ("MAPBOX_API_KEY",          "Mapbox Maps"),
        ("CLOUDINARY_URL",          "Cloudinary Media"),
        ("VERCEL_TOKEN",            "Vercel Deployment"),
        ("LEMON_SQUEEZY_API_KEY",   "LemonSqueezy Payments"),
        ("PAYPAL_CLIENT_ID",        "PayPal Payments"),
        ("VITE_API_URL",            "Vite API Base URL"),
        ("NEXT_PUBLIC_API_URL",     "Next.js API Base URL"),
        ("API_URL",                 "Generic API Endpoint"),
        ("BASE_URL",                "Base URL"),
        ("TAURI_PRIVATE_KEY",       "Tauri Updater"),
    ];

    // Scan .env files
    let env_files = [".env", ".env.local", ".env.example", ".env.sample",
                     ".env.development", ".env.production"];
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
                    apis.push(ApiConnection {
                        key:    pattern.to_string(),
                        hint:   hint.to_string(),
                        source: env_file.to_string(),
                    });
                }
            }
        }
    }

    // Also check package.json dependencies for API client hints
    let pkg = project_path.join("package.json");
    if let Ok(raw) = std::fs::read_to_string(&pkg) {
        let npm_hints: &[(&str, &str, &str)] = &[
            ("\"openai\"",          "OpenAI_SDK_USAGE",      "openai npm package"),
            ("\"@anthropic-ai/sdk\"","ANTHROPIC_SDK_USAGE",  "@anthropic-ai/sdk"),
            ("\"stripe\"",          "STRIPE_SDK_USAGE",      "stripe npm package"),
            ("\"firebase\"",        "FIREBASE_SDK_USAGE",    "firebase npm package"),
            ("\"@supabase/supabase-js\"", "SUPABASE_SDK",    "@supabase/supabase-js"),
            ("\"axios\"",           "HTTP_CLIENT_AXIOS",     "axios (HTTP client)"),
            ("\"@trpc/client\"",    "TRPC_CLIENT",           "@trpc/client"),
            ("\"socket.io-client\"","SOCKETIO_CLIENT",       "socket.io-client"),
            ("\"pusher-js\"",       "PUSHER_CLIENT",         "pusher-js"),
            ("\"twilio\"",          "TWILIO_SDK",            "twilio npm package"),
            ("\"resend\"",          "RESEND_SDK",            "resend npm package"),
            ("\"@clerk/nextjs\"",   "CLERK_AUTH",            "@clerk/nextjs"),
        ];
        for (pkg_name, key, hint) in npm_hints {
            if raw.contains(*pkg_name) && !found_keys.contains(*key) {
                found_keys.insert(key.to_string());
                apis.push(ApiConnection {
                    key:    key.to_string(),
                    hint:   hint.to_string(),
                    source: "package.json".to_string(),
                });
            }
        }
    }

    apis
}

/// Fetch git log for a specific branch
#[tauri::command]
pub fn get_git_log_for_branch(path: String, branch: String, limit: usize) -> Vec<crate::models::GitCommit> {
    get_git_log_branch(std::path::Path::new(&path), &branch, limit)
}

fn get_git_log_branch(project_path: &std::path::Path, branch: &str, limit: usize) -> Vec<crate::models::GitCommit> {
    let out = std::process::Command::new("git")
        .args(["log", branch, &format!("-{}", limit), "--pretty=format:%H|%h|%s|%an|%ci"])
        .current_dir(project_path)
        .output();
    let output = match out {
        Ok(o) if o.status.success() => o,
        _ => return vec![],
    };
    let raw = String::from_utf8_lossy(&output.stdout);
    raw.lines().filter_map(|line| {
        let parts: Vec<&str> = line.splitn(5, '|').collect();
        if parts.len() < 5 { return None; }
        Some(crate::models::GitCommit {
            hash: parts[0].to_string(), short_hash: parts[1].to_string(),
            message: parts[2].to_string(), author: parts[3].to_string(),
            date: parts[4].to_string(),
        })
    }).collect()
}
