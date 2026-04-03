use crate::models::{TimeEntry, WeeklyReport, MonthlyReport, ProjectTimeSummary, DailyTime, WeeklyTime};
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;
use chrono::Datelike;

/// Parse git log output and extract time entries based on commit patterns.
fn parse_git_log_for_time(project_path: &str, days: u32) -> Vec<TimeEntry> {
    let since = format!("--since={} days ago", days);
    let output = Command::new("git")
        .args(["log", "--format=%aI", "--all", &since])
        .current_dir(project_path)
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut timestamps: Vec<chrono::NaiveDateTime> = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(line) {
            timestamps.push(dt.naive_local());
        }
    }

    timestamps.sort();

    let project_name = Path::new(project_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| project_path.to_string());

    let mut daily_minutes: HashMap<String, f64> = HashMap::new();
    let max_session_gap_minutes = 120.0;
    let min_commit_time = 15.0;

    for window in timestamps.windows(2) {
        let gap = (window[1] - window[0]).num_minutes() as f64;
        let date = window[1].format("%Y-%m-%d").to_string();

        if gap <= max_session_gap_minutes && gap > 0.0 {
            *daily_minutes.entry(date).or_default() += gap;
        } else {
            *daily_minutes.entry(date).or_default() += min_commit_time;
        }
    }

    if let Some(first) = timestamps.first() {
        let date = first.format("%Y-%m-%d").to_string();
        *daily_minutes.entry(date).or_default() += min_commit_time;
    }

    daily_minutes.into_iter().map(|(date, minutes)| {
        TimeEntry {
            project_name: project_name.clone(),
            project_path: project_path.to_string(),
            date,
            duration_minutes: minutes.round() as u32,
            source: "git_commits".to_string(),
        }
    }).collect()
}

#[tauri::command]
pub fn time_get_weekly_report(project_paths: Vec<String>) -> WeeklyReport {
    let mut all_entries: Vec<TimeEntry> = Vec::new();
    for path in &project_paths {
        all_entries.extend(parse_git_log_for_time(path, 7));
    }

    let mut project_hours: HashMap<String, f64> = HashMap::new();
    let mut daily_hours: HashMap<String, f64> = HashMap::new();

    for entry in &all_entries {
        *project_hours.entry(entry.project_name.clone()).or_default() += entry.duration_minutes as f64 / 60.0;
        *daily_hours.entry(entry.date.clone()).or_default() += entry.duration_minutes as f64 / 60.0;
    }

    let total_hours: f64 = project_hours.values().sum();

    let mut projects: Vec<ProjectTimeSummary> = project_hours.into_iter().map(|(name, hours)| {
        let percentage = if total_hours > 0.0 { (hours / total_hours * 100.0).round() as u32 } else { 0 };
        ProjectTimeSummary {
            name,
            hours: (hours * 10.0).round() / 10.0,
            percentage,
        }
    }).collect();
    projects.sort_by(|a, b| b.hours.partial_cmp(&a.hours).unwrap_or(std::cmp::Ordering::Equal));

    let mut daily: Vec<DailyTime> = daily_hours.into_iter().map(|(date, hours)| {
        DailyTime { date, hours: (hours * 10.0).round() / 10.0 }
    }).collect();
    daily.sort_by(|a, b| a.date.cmp(&b.date));

    let today = chrono::Local::now().naive_local().date();
    let days_from_mon = today.weekday().num_days_from_monday() as i64;
    let week_start = today - chrono::Duration::days(days_from_mon);

    WeeklyReport {
        week_start: week_start.format("%Y-%m-%d").to_string(),
        total_hours: (total_hours * 10.0).round() / 10.0,
        projects,
        daily,
    }
}

#[tauri::command]
pub fn time_get_monthly_report(project_paths: Vec<String>, year: u32, month: u32) -> MonthlyReport {
    let mut all_entries: Vec<TimeEntry> = Vec::new();
    for path in &project_paths {
        all_entries.extend(parse_git_log_for_time(path, 60));
    }

    let month_prefix = format!("{:04}-{:02}", year, month);

    let month_entries: Vec<_> = all_entries.into_iter()
        .filter(|e| e.date.starts_with(&month_prefix))
        .collect();

    let mut project_hours: HashMap<String, f64> = HashMap::new();
    let mut weekly_hours: HashMap<String, f64> = HashMap::new();

    for entry in &month_entries {
        *project_hours.entry(entry.project_name.clone()).or_default() += entry.duration_minutes as f64 / 60.0;

        if let Some(day) = entry.date.split('-').last().and_then(|d| d.parse::<u32>().ok()) {
            let week = format!("W{}", (day - 1) / 7 + 1);
            *weekly_hours.entry(week).or_default() += entry.duration_minutes as f64 / 60.0;
        }
    }

    let total_hours: f64 = project_hours.values().sum();

    let mut projects: Vec<ProjectTimeSummary> = project_hours.into_iter().map(|(name, hours)| {
        let percentage = if total_hours > 0.0 { (hours / total_hours * 100.0).round() as u32 } else { 0 };
        ProjectTimeSummary {
            name,
            hours: (hours * 10.0).round() / 10.0,
            percentage,
        }
    }).collect();
    projects.sort_by(|a, b| b.hours.partial_cmp(&a.hours).unwrap_or(std::cmp::Ordering::Equal));

    let mut weekly: Vec<WeeklyTime> = weekly_hours.into_iter().map(|(week, hours)| {
        WeeklyTime { week, hours: (hours * 10.0).round() / 10.0 }
    }).collect();
    weekly.sort_by(|a, b| a.week.cmp(&b.week));

    MonthlyReport {
        month: month_prefix,
        total_hours: (total_hours * 10.0).round() / 10.0,
        projects,
        weekly,
    }
}

#[tauri::command]
pub fn time_export_csv(project_paths: Vec<String>, start_date: String, end_date: String, hourly_rate: f64) -> Result<String, String> {
    let mut all_entries: Vec<TimeEntry> = Vec::new();
    for path in &project_paths {
        all_entries.extend(parse_git_log_for_time(path, 90));
    }

    let filtered: Vec<_> = all_entries.into_iter()
        .filter(|e| e.date >= start_date && e.date <= end_date)
        .collect();

    let mut csv = String::from("Date,Project,Hours,Rate,Amount\n");
    let mut total_amount = 0.0;

    for entry in &filtered {
        let hours = entry.duration_minutes as f64 / 60.0;
        let amount = hours * hourly_rate;
        total_amount += amount;
        csv.push_str(&format!("{},{},{:.1},{:.2},{:.2}\n",
            entry.date, entry.project_name, hours, hourly_rate, amount));
    }

    let total_hours: f64 = filtered.iter().map(|e| e.duration_minutes as f64 / 60.0).sum();
    csv.push_str(&format!("\nTotal,,{:.1},,{:.2}\n", total_hours, total_amount));

    Ok(csv)
}
