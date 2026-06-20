import { expect, type Page, test } from '@playwright/test';

type BrowserErrorWatch = {
  assertClean: () => void;
};

const watchBrowserErrors = (page: Page): BrowserErrorWatch => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.url()} ${request.failure()?.errorText ?? ''}`.trim());
  });

  return {
    assertClean: () => {
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(requestFailures).toEqual([]);
    }
  };
};

const installSnapshotProbe = async (page: Page) => {
  await page.addInitScript(() => {
    window.addEventListener('game:snapshot', (event) => {
      (window as unknown as { __hermesLatestSnapshot?: unknown }).__hermesLatestSnapshot = (
        event as CustomEvent
      ).detail;
    });
  });
};

const installTeachingProbe = async (page: Page) => {
  await page.addInitScript(() => {
    const target = window as unknown as { __hermesTeachingHints?: Array<{ id: string; text: string }> };
    target.__hermesTeachingHints = [];
    window.addEventListener('game:teaching', (event) => {
      target.__hermesTeachingHints?.push((event as CustomEvent<{ id: string; text: string }>).detail);
    });
  });
};

const installAudioProbe = async (page: Page) => {
  await page.addInitScript(() => {
    const target = window as unknown as {
      __hermesAudioProbe?: { oscillatorCreates: number; resumeCalls: number };
    };
    const OriginalAudioContext = window.AudioContext;

    target.__hermesAudioProbe = { oscillatorCreates: 0, resumeCalls: 0 };

    class CountingAudioContext extends OriginalAudioContext {
      createOscillator() {
        target.__hermesAudioProbe!.oscillatorCreates += 1;
        return super.createOscillator();
      }

      resume() {
        target.__hermesAudioProbe!.resumeCalls += 1;
        return super.resume();
      }
    }

    window.AudioContext = CountingAudioContext;
  });
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
};

const holdKey = async (page: Page, key: string) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
};

const startTestRun = async (page: Page) => {
  await page.goto('/?skipIntro=1&testMode=1&manualSpawns=1');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'ready');
  await page.locator('#startButton').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
};

const spawnTestEntity = async (page: Page, detail: Record<string, unknown>) => {
  await page.evaluate((spawnDetail) => {
    window.dispatchEvent(new CustomEvent('test:spawnEntity', { detail: spawnDetail }));
  }, detail);
};

const activateTestPower = async (page: Page, detail: Record<string, unknown>) => {
  await page.evaluate((powerDetail) => {
    window.dispatchEvent(new CustomEvent('test:activatePower', { detail: powerDetail }));
  }, detail);
};

test('plays the first-run intro and reaches the start menu', async ({ page }, testInfo) => {
  const browserErrors = watchBrowserErrors(page);
  const narrationRequests: string[] = [];
  page.on('requestfinished', (request) => {
    if (request.url().includes('intro-narration')) {
      narrationRequests.push(request.url());
    }
  });

  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'intro');
  await expect(page.locator('#introOverlay')).toBeVisible();
  await expect(page.locator('#introSkipButton')).toBeEnabled();
  await page.locator('#introSoundButton').click();
  await expect
    .poll(() => narrationRequests.length, { timeout: 8000 })
    .toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('intro.png'), fullPage: false });

  await page.locator('#introSkipButton').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'ready');
  await expect(page.locator('#startPanel')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'intro');
  await expect(page.locator('#introOverlay')).toBeVisible();
  await expect(page.locator('#introSkipButton')).toBeEnabled();
  await expectNoHorizontalOverflow(page);

  browserErrors.assertClean();
});

test('boots, starts Daily Dispatch, pauses, and renders release result UI', async ({ page }, testInfo) => {
  const browserErrors = watchBrowserErrors(page);
  await installAudioProbe(page);

  await page.goto('/?skipIntro=1&testMode=1');
  await expect(page.locator('#startButton')).toBeVisible();
  await expect(page.locator('#modeDailyButton')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ready.png'), fullPage: false });

  await page.locator('#modeDailyButton').click();
  await expect(page.locator('#modeDailyButton')).toHaveClass(/is-active/);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.locator('#startButton').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  await expect(page.locator('#routeSegmentHud')).toContainText(/Circuit|Gate|Agora|Descent/);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        return (
          (window as unknown as { __hermesAudioProbe?: { oscillatorCreates: number } }).__hermesAudioProbe
            ?.oscillatorCreates ?? 0
        );
      })
    )
    .toBeGreaterThan(0);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('game:sfx', { detail: 'chomp' })));
  await expect
    .poll(async () =>
      page.evaluate(() => {
        return (
          (window as unknown as { __hermesAudioProbe?: { oscillatorCreates: number } }).__hermesAudioProbe
            ?.oscillatorCreates ?? 0
        );
      })
    )
    .toBeGreaterThan(1);

  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('ui:action', { detail: { action: 'pause', pressed: true } }))
  );
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'paused');
  await page.locator('#resumeButton').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('test:forceGameOver')));
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'gameover');
  await expect(page.locator('#finalRunMode')).toContainText('Daily Dispatch');
  await expect(page.locator('#finalRoute')).not.toBeEmpty();
  await expect(page.locator('#finalCourierSeals')).not.toBeEmpty();
  await expect(page.locator('#shareStatus')).toContainText('Hermes: Godspeed');
  await page.waitForTimeout(350);
  await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: false });

  await expectNoHorizontalOverflow(page);
  browserErrors.assertClean();
});

test('supports real desktop keyboard and mobile touch controls', async ({ page }, testInfo) => {
  const browserErrors = watchBrowserErrors(page);
  await installSnapshotProbe(page);

  await page.goto('/?skipIntro=1&testMode=1');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'ready');
  await page.locator('#startButton').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');

  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('.mobile-controls')).toBeVisible();
    await page.locator('[data-action="laneRight"]').tap();
    await page.waitForFunction(() => {
      const snapshot = (window as unknown as { __hermesLatestSnapshot?: { playerLane?: number } }).__hermesLatestSnapshot;
      return snapshot?.playerLane === 2;
    });

    await page.locator('[data-action="jump"]').tap();
    await page.waitForFunction(() => {
      const snapshot = (window as unknown as { __hermesLatestSnapshot?: { verticalOffset?: number } })
        .__hermesLatestSnapshot;
      return (snapshot?.verticalOffset ?? 0) > 0;
    });
  } else {
    await page.mouse.click(640, 360);
    await holdKey(page, 'ArrowLeft');
    await page.waitForFunction(() => {
      const snapshot = (window as unknown as { __hermesLatestSnapshot?: { playerLane?: number } }).__hermesLatestSnapshot;
      return snapshot?.playerLane === 0;
    });

    await holdKey(page, 'ArrowRight');
    await page.waitForFunction(() => {
      const snapshot = (window as unknown as { __hermesLatestSnapshot?: { playerLane?: number } }).__hermesLatestSnapshot;
      return snapshot?.playerLane === 1;
    });

    await holdKey(page, 'Space');
    await page.waitForFunction(() => {
      const snapshot = (window as unknown as { __hermesLatestSnapshot?: { verticalOffset?: number } })
        .__hermesLatestSnapshot;
      return (snapshot?.verticalOffset ?? 0) > 0;
    });

    await holdKey(page, 'P');
    await expect(page.locator('body')).toHaveAttribute('data-phase', 'paused');
  }

  await page.screenshot({ path: testInfo.outputPath('controls.png'), fullPage: false });
  await expectNoHorizontalOverflow(page);
  browserErrors.assertClean();
});

test('cycles Hermes through distinct running, sliding, and airborne art frames', async ({ page }, testInfo) => {
  const browserErrors = watchBrowserErrors(page);
  await installSnapshotProbe(page);
  await startTestRun(page);

  const runningFrames = new Set<number>();
  const runningFrameSamples = new Map<number, { flipX: boolean }>();
  for (let sample = 0; sample < 10; sample += 1) {
    await page.waitForTimeout(70);
    const visual = await page.evaluate(() => {
      const testWindow = window as unknown as { __hermesPlayerFrame?: number; __hermesPlayerFlipX?: boolean };
      return { frame: testWindow.__hermesPlayerFrame ?? -1, flipX: testWindow.__hermesPlayerFlipX ?? false };
    });
    const frame = visual.frame;
    runningFrames.add(frame);
    runningFrameSamples.set(frame, visual);
  }
  expect([...runningFrames].filter((frame) => frame >= 0).length).toBeGreaterThanOrEqual(3);
  expect(runningFrameSamples.get(2)?.flipX).toBe(true);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ui:action', { detail: { action: 'slide', pressed: true } })));
  await page.waitForFunction(
    () => (window as unknown as { __hermesPlayerFrame?: number }).__hermesPlayerFrame === 1
  );
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ui:action', { detail: { action: 'slide', pressed: false } })));

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ui:action', { detail: { action: 'jump', pressed: true } })));
  await page.waitForFunction(
    () => (window as unknown as { __hermesPlayerFrame?: number }).__hermesPlayerFrame === 3
  );

  await page.screenshot({ path: testInfo.outputPath('hermes-run-cycle.png'), fullPage: false });
  browserErrors.assertClean();
});

test('uses clear obstacle rules for low, high, and smash-mode contacts', async ({ page }, testInfo) => {
  const browserErrors = watchBrowserErrors(page);
  await installSnapshotProbe(page);
  await installTeachingProbe(page);

  await startTestRun(page);

  await spawnTestEntity(page, { kind: 'obstacle-low', lane: 1, offsetX: 28 });
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { strikesTaken?: number } })
      .__hermesLatestSnapshot;
    return snapshot?.strikesTaken === 1;
  });

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ui:action', { detail: { action: 'jump', pressed: true } })));
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { verticalOffset?: number } })
      .__hermesLatestSnapshot;
    return (snapshot?.verticalOffset ?? 0) > 120;
  });
  await spawnTestEntity(page, { kind: 'obstacle-low', lane: 1, offsetX: 76 });
  await page.waitForTimeout(460);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const snapshot = (window as unknown as { __hermesLatestSnapshot?: { strikesTaken?: number } })
          .__hermesLatestSnapshot;
        return snapshot?.strikesTaken;
      })
    )
    .toBe(1);

  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { verticalOffset?: number } })
      .__hermesLatestSnapshot;
    return (snapshot?.verticalOffset ?? 1) === 0;
  });
  await spawnTestEntity(page, { kind: 'obstacle-high', lane: 1, offsetX: 28 });
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { strikesTaken?: number } })
      .__hermesLatestSnapshot;
    return snapshot?.strikesTaken === 2;
  });

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ui:action', { detail: { action: 'slide', pressed: true } })));
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { isSliding?: boolean } }).__hermesLatestSnapshot;
    return snapshot?.isSliding;
  });
  await spawnTestEntity(page, { kind: 'obstacle-high', lane: 1, offsetX: 76 });
  await page.waitForTimeout(760);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ui:action', { detail: { action: 'slide', pressed: false } })));
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const snapshot = (window as unknown as { __hermesLatestSnapshot?: { strikesTaken?: number } })
          .__hermesLatestSnapshot;
        return snapshot?.strikesTaken;
      })
    )
    .toBe(2);

  await activateTestPower(page, { power: 'chomp' });
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { canEatObstacles?: boolean } })
      .__hermesLatestSnapshot;
    return snapshot?.canEatObstacles;
  });
  await spawnTestEntity(page, { kind: 'obstacle-low', lane: 1, offsetX: 28 });
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as {
      __hermesLatestSnapshot?: { obstaclesSmashed?: number; strikesTaken?: number };
    }).__hermesLatestSnapshot;
    return snapshot?.obstaclesSmashed === 1 && snapshot?.strikesTaken === 2;
  });

  const hints = await page.evaluate(() => {
    return (window as unknown as { __hermesTeachingHints?: Array<{ text: string }> }).__hermesTeachingHints?.map(
      (hint) => hint.text
    );
  });
  expect(hints).toEqual(
    expect.arrayContaining(['JUMP LOW BLOCKS', 'SLIDE UNDER ZAPS', 'SMASH MODE: OBSTACLES ARE SAFE'])
  );

  await page.screenshot({ path: testInfo.outputPath('obstacle-rules.png'), fullPage: false });
  await expectNoHorizontalOverflow(page);
  browserErrors.assertClean();
});

test('collects pickups generously while keeping lane and magnet rules deterministic', async ({ page }, testInfo) => {
  const browserErrors = watchBrowserErrors(page);
  await installSnapshotProbe(page);
  await startTestRun(page);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ui:action', { detail: { action: 'slide', pressed: true } })));
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { isSliding?: boolean } }).__hermesLatestSnapshot;
    return snapshot?.isSliding;
  });
  await spawnTestEntity(page, { kind: 'lobster', lane: 1, offsetX: 54 });
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { lobsters?: number } }).__hermesLatestSnapshot;
    return snapshot?.lobsters === 1;
  });

  await spawnTestEntity(page, { kind: 'golden-lobster', lane: 0, offsetX: 54 });
  await page.waitForTimeout(720);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const snapshot = (window as unknown as { __hermesLatestSnapshot?: { lobsters?: number } }).__hermesLatestSnapshot;
        return snapshot?.lobsters;
      })
    )
    .toBe(1);

  await activateTestPower(page, { power: 'magnet' });
  await spawnTestEntity(page, { kind: 'golden-lobster', lane: 0, offsetX: 180 });
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { lobsters?: number } }).__hermesLatestSnapshot;
    return (snapshot?.lobsters ?? 0) > 1;
  });

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ui:action', { detail: { action: 'slide', pressed: false } })));
  await spawnTestEntity(page, { kind: 'powerup', lane: 1, offsetX: 70, power: 'goblet' });
  await page.waitForFunction(() => {
    const snapshot = (window as unknown as { __hermesLatestSnapshot?: { powerupsCollected?: number } })
      .__hermesLatestSnapshot;
    return snapshot?.powerupsCollected === 2;
  });

  await spawnTestEntity(page, { kind: 'obstacle-low', lane: 0, offsetX: 48 });
  await spawnTestEntity(page, { kind: 'obstacle-high', lane: 2, offsetX: 150 });
  await page.waitForTimeout(900);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const snapshot = (window as unknown as { __hermesLatestSnapshot?: { strikesTaken?: number } })
          .__hermesLatestSnapshot;
        return snapshot?.strikesTaken;
      })
    )
    .toBe(0);

  await page.screenshot({ path: testInfo.outputPath('pickup-collision-rules.png'), fullPage: false });
  browserErrors.assertClean();
});

test('explains hazards and every illustrated powerup in the help guide', async ({ page }, testInfo) => {
  const browserErrors = watchBrowserErrors(page);
  await page.goto('/?skipIntro=1');
  await page.locator('#helpButtonStart').click();
  await expect(page.locator('#helpModal')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.danger-card')).toHaveCount(2);
  await expect(page.locator('.power-card')).toHaveCount(5);
  await expect(page.locator('#helpModal')).toContainText('Red-orange machinery causes strikes');
  await expect(page.locator('#helpModal')).toContainText('Gold and cyan rewards are always safe to collect');
  await expect(page.locator('#helpModal')).toContainText('Divine Chomp');
  await expect(page.locator('#helpModal')).toContainText('Winged Sandals');
  await expect(page.locator('#helpModal')).toContainText('Golden Goblet');
  await expect(page.locator('#helpModal')).toContainText('Zeus Bolt');
  await expect(page.locator('#helpModal')).toContainText('Lobster Magnet');
  await expect(page.locator('.help-asset-card img').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('help-guide.png'), fullPage: false });
  await page.getByRole('heading', { name: 'Divine Powerups' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('powerup-guide.png'), fullPage: false });
  browserErrors.assertClean();
});

test('renders hazards and divine relics with distinct in-game silhouettes', async ({ page }, testInfo) => {
  const browserErrors = watchBrowserErrors(page);
  await installSnapshotProbe(page);
  await startTestRun(page);

  const compact = (page.viewportSize()?.width ?? 1280) < 600;
  const positions = compact ? [255, 305, 345, 385] : [560, 760, 880, 1060];
  await spawnTestEntity(page, { kind: 'powerup', lane: 0, x: positions[0], power: 'chomp' });
  await spawnTestEntity(page, { kind: 'obstacle-high', lane: 0, x: positions[1] });
  await spawnTestEntity(page, { kind: 'powerup', lane: 1, x: positions[2], power: 'sandals' });
  await spawnTestEntity(page, { kind: 'obstacle-low', lane: 2, x: positions[3] });
  await page.waitForTimeout(80);
  await page.screenshot({ path: testInfo.outputPath('hazard-powerup-contrast.png'), fullPage: false });
  browserErrors.assertClean();
});
