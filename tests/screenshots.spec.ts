import { test, expect } from '@playwright/test';

test.describe('Weavenote Screenshot Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('Homepage - Main Interface', async ({ page }) => {
    // Take a screenshot of the main interface
    await page.screenshot({ 
      path: 'screenshots/01-homepage.png',
      fullPage: true 
    });
    
    // Verify key elements are visible
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('text=WeaveNote')).toBeVisible();
  });

  test('Settings Panel - Access Point', async ({ page }) => {
    // Find and highlight the settings gear icon
    const settingsButton = page.locator('button:has-text("⚙️")');
    await expect(settingsButton).toBeVisible();
    
    // Take screenshot showing the settings button location
    await page.screenshot({ 
      path: 'screenshots/02-settings-button-location.png',
      clip: { x: 0, y: 0, width: 1280, height: 100 }
    });
    
    // Click settings button
    await settingsButton.click();
    
    // Wait for settings panel to appear
    await page.waitForSelector('text=System Control', { timeout: 5000 });
    
    // Take screenshot of settings panel
    await page.screenshot({ 
      path: 'screenshots/03-settings-panel.png',
      fullPage: true 
    });
  });

  test('Settings Panel - Visual Settings Tab', async ({ page }) => {
    // Open settings
    await page.click('button:has-text("⚙️")');
    await page.waitForSelector('text=System Control');
    
    // Take screenshot of Visuals tab
    await page.screenshot({ 
      path: 'screenshots/04-settings-visuals.png',
      fullPage: true 
    });
  });

  test('Settings Panel - All Tabs Navigation', async ({ page }) => {
    // Open settings
    await page.click('button:has-text("⚙️")');
    await page.waitForSelector('text=System Control');
    
    const tabs = [
      { name: 'Visuals', selector: 'button:has-text("Visuals")' },
      { name: 'My Security', selector: 'button:has-text("My Security")' },
      { name: 'AI Engine', selector: 'button:has-text("AI Engine")' },
      { name: 'Diagnostics', selector: 'button:has-text("Diagnostics")' },
    ];
    
    for (const tab of tabs) {
      await page.click(tab.selector);
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: `screenshots/05-settings-${tab.name.toLowerCase().replace(' ', '-')}.png`,
        fullPage: true 
      });
    }
  });

  test('Note Creation Interface', async ({ page }) => {
    // Take screenshot of note input area
    const noteInput = page.locator('textarea').first();
    if (await noteInput.isVisible()) {
      await page.screenshot({ 
        path: 'screenshots/06-note-input.png',
        clip: { x: 0, y: 200, width: 1280, height: 400 }
      });
    }
  });

  test('Theme Selection', async ({ page }) => {
    // Open settings
    await page.click('button:has-text("⚙️")');
    await page.waitForSelector('text=System Control');
    
    // Navigate to Visuals tab
    await page.click('button:has-text("Visuals")');
    
    // Take screenshot of theme selector
    await page.screenshot({ 
      path: 'screenshots/07-theme-selector.png',
      clip: { x: 400, y: 200, width: 600, height: 400 }
    });
  });

  test('Dark Mode Toggle', async ({ page }) => {
    // Open settings
    await page.click('button:has-text("⚙️")');
    await page.waitForSelector('text=System Control');
    
    // Find dark mode toggle
    const darkModeToggle = page.getByRole('switch', { name: 'Toggle Dark Mode' });
    
    // Take screenshot before toggle
    await page.screenshot({ 
      path: 'screenshots/08-darkmode-before.png',
      clip: { x: 400, y: 200, width: 500, height: 200 }
    });
    
    // Toggle dark mode
    await darkModeToggle.click();
    await page.waitForTimeout(500);
    
    // Take screenshot after toggle
    await page.screenshot({ 
      path: 'screenshots/09-darkmode-after.png',
      clip: { x: 400, y: 200, width: 500, height: 200 }
    });
  });

  test('View Modes - Grid and Mindmap', async ({ page }) => {
    // Take screenshot of grid view
    await page.screenshot({ 
      path: 'screenshots/10-grid-view.png',
      fullPage: true 
    });
    
    // Switch to mindmap view if available
    const mindmapButton = page.locator('button').filter({ has: page.locator('circle') }).nth(1);
    if (await mindmapButton.isVisible()) {
      await mindmapButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: 'screenshots/11-mindmap-view.png',
        fullPage: true 
      });
    }
  });

  test('Search Functionality', async ({ page }) => {
    // Find search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: 'screenshots/12-search-active.png',
        clip: { x: 0, y: 0, width: 1280, height: 100 }
      });
    }
  });

  test('Tab Navigation', async ({ page }) => {
    // Take screenshot of tab bar
    const tabs = ['quick', 'deep', 'code', 'project'];
    
    for (const tab of tabs) {
      const tabButton = page.locator(`button:has-text("${tab.charAt(0).toUpperCase() + tab.slice(1)}")`);
      if (await tabButton.first().isVisible()) {
        await tabButton.first().click();
        await page.waitForTimeout(300);
        await page.screenshot({ 
          path: `screenshots/13-tab-${tab}.png`,
          fullPage: true 
        });
      }
    }
  });

  test('Documentation - Settings Entry Point', async ({ page }) => {
    // This test demonstrates where users can access settings
    // for the ENV configuration
    
    // Open settings
    await page.click('button:has-text("⚙️")');
    await page.waitForSelector('text=System Control');
    
    // Highlight the settings panel
    await page.evaluate(() => {
      const panel = document.querySelector('[class*="fixed inset-0"]');
      if (panel) {
        panel.style.border = '3px solid #4F46E5';
      }
    });
    
    await page.screenshot({ 
      path: 'screenshots/14-settings-entry-point.png',
      fullPage: true 
    });
  });
});

test.describe('Admin Settings Tests', () => {
  
  test.skip('ENV Settings Page (Requires Admin Login)', async ({ page }) => {
    // This test requires admin login
    // Login as admin first
    
    // Navigate to settings
    await page.click('button:has-text("⚙️")');
    await page.waitForSelector('text=System Control');
    
    // Click on ENV Settings tab
    await page.click('button:has-text("ENV Settings")');
    
    // Take screenshot of ENV settings page
    await page.screenshot({ 
      path: 'screenshots/15-env-settings.png',
      fullPage: true 
    });
    
    // Take screenshot of add variable modal
    await page.click('button:has-text("+ Add Variable")');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'screenshots/16-add-env-variable.png',
      fullPage: true 
    });
  });

  test.skip('Versioning Page (Requires Admin Login)', async ({ page }) => {
    // This test requires admin login
    
    // Navigate to settings
    await page.click('button:has-text("⚙️")');
    await page.waitForSelector('text=System Control');
    
    // Click on Versioning tab
    await page.click('button:has-text("Versioning")');
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/17-versioning.png',
      fullPage: true 
    });
  });
});
