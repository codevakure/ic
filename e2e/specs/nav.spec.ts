import { expect, test } from '@playwright/test';

test.describe('Navigation suite', () => {
  test('Navigation bar', async ({ page }) => {
    await page.goto('http://localhost:3080/', { timeout: 5000 });

    await page.getByTestId('nav-user').click();
    const navSettings = await page.getByTestId('nav-user').isVisible();
    expect(navSettings).toBeTruthy();
  });

  test('Profile page navigation', async ({ page }) => {
    await page.goto('http://localhost:3080/', { timeout: 5000 });
    await page.getByTestId('nav-user').click();
    await page.getByRole('menuitem', { name: /Profile/i }).click();

    // Wait for navigation to /profile page
    await page.waitForURL('**/profile', { timeout: 5000 });

    const profileHeader = await page.getByRole('heading', { name: /Profile/ }).isVisible();
    expect(profileHeader).toBeTruthy();

    // Check if sidebar tabs are visible
    const profileTab = await page.getByRole('button', { name: /Profile/ }).isVisible();
    expect(profileTab).toBeTruthy();

    const generalTab = await page.getByRole('button', { name: /General/ }).isVisible();
    expect(generalTab).toBeTruthy();

    const chatTab = await page.getByRole('button', { name: /Chat/ }).isVisible();
    expect(chatTab).toBeTruthy();
  });

  test('Settings tabs in profile page', async ({ page }) => {
    await page.goto('http://localhost:3080/profile', { timeout: 5000 });

    // Check if all settings tabs are present
    const tabs = ['Profile', 'General', 'Chat', 'Commands', 'Speech', 'Shared links'];
    
    for (const tabName of tabs) {
      const tab = await page.getByRole('button', { name: new RegExp(tabName, 'i') }).isVisible();
      expect(tab).toBeTruthy();
    }

    // Click on General tab and verify it shows content
    await page.getByRole('button', { name: /General/i }).click();
    const generalContent = await page.getByText(/Customize your theme and appearance/i).isVisible();
    expect(generalContent).toBeTruthy();

    // Check theme selector exists
    const modalTheme = page.getByTestId('theme-selector');
    expect(modalTheme).toBeTruthy();

    async function changeMode(theme: string) {
      // Ensure Element Visibility:
      await page.waitForSelector('[data-testid="theme-selector"]');
      await modalTheme.click();

      await page.click(`[data-theme="${theme}"]`);

      // Wait for the theme change
      await page.waitForTimeout(1000);

      // Check if the HTML element has the theme class
      const html = await page.$eval(
        'html',
        (element, selectedTheme) => element.classList.contains(selectedTheme.toLowerCase()),
        theme,
      );
      expect(html).toBeTruthy();
    }

    await changeMode('dark');
    await changeMode('light');
  });
});
