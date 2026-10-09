import { expect, test, type Page } from '@playwright/test'

/** Full facilitator + team flow through the UI (T-095). Requires `make dev`. */
test('facilitator runs a session; a team plays Round 1, Year 1 results and the board pitch', async ({
  browser,
}) => {
  const fac = await (await browser.newContext()).newPage()
  const errors: string[] = []
  fac.on('pageerror', (e) => errors.push(String(e)))

  // Facilitator creates a session from the landing page.
  await fac.goto('/')
  await fac.getByRole('tab', { name: /Facilitate/ }).click()
  await fac.getByLabel('Session name').fill('E2E pilot')
  await fac.getByRole('button', { name: /Create session/ }).click()
  await expect(fac.getByText('Facilitator console')).toBeVisible()

  const codes = await fac.locator('.team-card__code').allTextContents()
  expect(codes).toHaveLength(3)
  await fac.getByRole('button', { name: /Start session/ }).click()
  await fac.getByRole('button', { name: /Next stage/ }).click()
  await fac.getByRole('button', { name: /Next stage/ }).click() // → Diagnose

  // A team joins with its code.
  const team = await (await browser.newContext()).newPage()
  team.on('pageerror', (e) => errors.push(String(e)))
  await team.goto('/')
  await team.getByLabel('Team join code').fill(codes[0].trim())
  await team.getByRole('button', { name: /Enter workspace/ }).click()
  await expect(team.locator('.topbar')).toContainText('Diagnose')

  // Data room and analyst (retrieval-only works without an API key).
  await team.getByRole('link', { name: /Data room/ }).click()
  await team.locator('.dataroom__item').first().click()
  await expect(team.locator('.dataroom__viewer h2').first()).toBeVisible()
  await team.getByRole('link', { name: /AI analyst/ }).click()
  await team.getByLabel('Your question').fill('Where are complaints concentrated?')
  await team.getByRole('button', { name: 'Send' }).click()
  // With an API key this is a real Claude call (15–25 s); without one it is instant retrieval.
  await expect(team.locator('.analyst__a .md').first()).toBeVisible({ timeout: 60_000 })

  // Round 1: add two investments, state a thesis, submit.
  await team.getByRole('link', { name: /Invest/ }).click()
  await team.getByRole('button', { name: /^Add I17 / }).click()
  await team.getByRole('button', { name: /^Add I10 / }).click()
  await team.getByLabel('Accountable executive for I10').fill('Chief Compliance Officer')
  await expect(team.locator('.capacity')).toBeVisible()
  await team.getByLabel('Investment thesis').fill('Fix foundations first, then scale what works.')
  await expect(team.getByText('Draft saved')).toBeVisible({ timeout: 10_000 })
  await team.getByRole('button', { name: /Submit Round 1/ }).click()
  await team.getByRole('dialog').getByRole('button', { name: 'Submit' }).click()
  await expect(team.getByText('Round 1 submitted').first()).toBeVisible()

  // Facilitator force-simulates Year 1 (other teams have not submitted).
  await fac.bringToFront()
  await fac.getByRole('button', { name: /Force-submit drafts and simulate/ }).click()
  // Review before release (pack 9.2): teams see results only once the facilitator releases them.
  await fac.getByRole('button', { name: /Release Year 1 performance review/ }).click()
  await expect(fac.getByText('Year 1 review released')).toBeVisible()
  await expect(fac.getByRole('button', { name: /Grant Round 2 capital/ })).toBeVisible()

  // Team sees its Year 1 performance review via realtime refresh.
  await team.bringToFront()
  await team.getByRole('link', { name: /Results/ }).click()
  await expect(team.getByRole('heading', { name: 'Year 1 performance review' })).toBeVisible()
  await expect(team.getByText('Result drivers by card')).toBeVisible()

  // Board pitch: the team submits; the facilitator scores it on the rubric with an audit note.
  await team.getByRole('link', { name: /Board pitch/ }).click()
  await team
    .getByLabel('What Round 1 produced')
    .fill('Abandonment fell after the IVR went live; measures lag a rating year.')
  await team
    .getByLabel('Why it differed from your thesis')
    .fill('Measures lag because they move in the next rating year.')
  await team
    .getByLabel('What you will scale, modify, pause or cancel')
    .fill('Fund I15 because providers have no reason to act.')
  await team
    .getByLabel('A risk your portfolio creates, and its control')
    .fill('Providers may game measures; audits control it.')
  await team.getByLabel('The ask').fill('Fund provider incentives.')
  await team.getByRole('button', { name: /Submit pitch for scoring/ }).click()
  await expect(team.getByText('Pitch submitted').first()).toBeVisible()

  await fac.bringToFront()
  await fac
    .getByRole('button', { name: /^Score$/ })
    .first()
    .click()
  const dialog = fac.getByRole('dialog')
  await expect(dialog.getByText(/Suggested by/)).toBeVisible({ timeout: 60_000 })
  await dialog.getByLabel('Audit note (required)').fill('Scored live during the pitch')
  await dialog.getByRole('button', { name: 'Save score' }).click()
  await expect(dialog).toBeHidden()

  expect(errors).toEqual([])
})

async function noHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1)
}

test('landing page has no horizontal overflow on a phone', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto('/')
  expect(await noHorizontalOverflow(page)).toBe(true)
})
