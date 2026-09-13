const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const rippleguardUrl = process.env.INPUT_RIPPLEGUARD_URL || 'http://localhost:4000';
    const filePath = process.env.INPUT_FILE_PATH || 'package-lock.json';
    const threshold = parseFloat(process.env.INPUT_THRESHOLD || '70');
    const isDemo = (process.env.INPUT_IS_DEMO || 'false').toLowerCase() === 'true';
    const githubToken = process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

    const resolvedPath = path.resolve(process.cwd(), filePath);
    console.log(`[RippleGuard Action] Checking dependency file at: ${resolvedPath}`);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Specified dependency file does not exist: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    const filename = path.basename(resolvedPath);

    // Extract GitHub event context if present
    let prNumber = 1;
    let repoFullName = 'owner/repo';
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (eventPath && fs.existsSync(eventPath)) {
      const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      if (eventData.pull_request) {
        prNumber = eventData.pull_request.number;
        repoFullName = eventData.repository ? eventData.repository.full_name : repoFullName;
      }
    }

    console.log(`[RippleGuard Action] Sending payload to ${rippleguardUrl}/api/github/gate-check...`);

    const response = await fetch(`${rippleguardUrl}/api/github/gate-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: repoFullName,
        filename,
        content,
        threshold,
        prNumber,
        isDemo,
      }),
    });

    if (!response.ok) {
      throw new Error(`RippleGuard Gate API returned status ${response.status}`);
    }

    const result = await response.json();
    console.log('\n' + result.markdownComment + '\n');

    // Post PR comment if token and repo are available
    if (githubToken && repoFullName !== 'owner/repo' && prNumber) {
      try {
        const commentUrl = `https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`;
        await fetch(commentUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: result.markdownComment }),
        });
        console.log(`[RippleGuard Action] Posted analysis comment to PR #${prNumber}`);
      } catch (commentErr) {
        console.warn(`[RippleGuard Action] Could not post PR comment: ${commentErr.message}`);
      }
    }

    // Set GitHub Actions output parameters
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `can_merge=${result.canMerge}\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `risk_score=${result.overallRiskScore}\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `risk_level=${result.riskLevel}\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `gate_status=${result.gateStatus}\n`);
    }

    if (!result.canMerge) {
      console.error(`::error::[RippleGuard] PR BLOCKED: Risk score ${result.overallRiskScore}/100 exceeds allowable threshold (${threshold}). Merge blocked.`);
      process.exit(1);
    } else {
      console.log(`::notice::[RippleGuard] PR PASSED: Risk score ${result.overallRiskScore}/100 meets security policies. Merge allowed.`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`::error::[RippleGuard Execution Failure] ${error.message}`);
    process.exit(1);
  }
}

run();
