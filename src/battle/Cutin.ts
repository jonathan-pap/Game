// Battle cut-in animation: a brief fullscreen-ish overlay drawn inside the
// Phaser scene that pauses the action, shows attacker and defender portraits
// (placeholder colored boxes for now), animates an effect, then fades out.

import Phaser from "phaser";
import { UnitInstance } from "./state";

export interface CutinOpts {
  attacker: UnitInstance;
  defender: UnitInstance;
  // Effect text drawn over the defender (e.g., "-12", "miss", "HEAL +30").
  // Color hint: damage = yellow, miss = grey, heal = green.
  effectText: string;
  effectColor: string;
  hit: boolean;
  duration?: number; // total ms; default 700
}

const SIDE_BG: Record<"player" | "enemy", number> = {
  player: 0x4a90e2,
  enemy: 0xd05050,
};

// Run a cut-in. Returns a Promise that resolves when it's done.
export function playCutin(scene: Phaser.Scene, opts: CutinOpts): Promise<void> {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const dur = opts.duration ?? 700;

  // Backdrop dim.
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0, 0).setDepth(900);

  // Two diagonal banners: attacker top-left, defender bottom-right.
  const bannerH = Math.floor(H * 0.32);
  const aBanner = scene.add.graphics().setDepth(901);
  aBanner.fillStyle(SIDE_BG[opts.attacker.template.side], 0.95);
  aBanner.fillRect(-W, 0, W * 2, bannerH);
  aBanner.lineStyle(2, 0xffffff, 0.9);
  aBanner.lineBetween(-W, bannerH, W * 2, bannerH);
  aBanner.x = -W;

  const dBanner = scene.add.graphics().setDepth(901);
  dBanner.fillStyle(SIDE_BG[opts.defender.template.side], 0.95);
  dBanner.fillRect(-W, H - bannerH, W * 2, bannerH);
  dBanner.lineStyle(2, 0xffffff, 0.9);
  dBanner.lineBetween(-W, H - bannerH, W * 2, H - bannerH);
  dBanner.x = W;

  // Portrait placeholders + names.
  const aText = scene.add
    .text(W * 0.18, bannerH / 2, opts.attacker.template.name, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(902)
    .setAlpha(0);

  const aClass = scene.add
    .text(W * 0.18, bannerH / 2 + 20, opts.attacker.template.class.toUpperCase(), {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#dddddd",
    })
    .setOrigin(0.5, 0.5)
    .setDepth(902)
    .setAlpha(0);

  const dText = scene.add
    .text(W * 0.82, H - bannerH / 2, opts.defender.template.name, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(902)
    .setAlpha(0);

  const dClass = scene.add
    .text(W * 0.82, H - bannerH / 2 + 20, opts.defender.template.class.toUpperCase(), {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#dddddd",
    })
    .setOrigin(0.5, 0.5)
    .setDepth(902)
    .setAlpha(0);

  // Effect text (damage/heal number) appears mid-screen over the defender side.
  const fx = scene.add
    .text(W * 0.82, H - bannerH / 2 - 40, opts.effectText, {
      fontFamily: "monospace",
      fontSize: "32px",
      color: opts.effectColor,
      stroke: "#000000",
      strokeThickness: 4,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(903)
    .setAlpha(0)
    .setScale(2);

  return new Promise<void>((resolve) => {
    // Slide banners in.
    scene.tweens.add({ targets: aBanner, x: 0, duration: 180, ease: "Quad.easeOut" });
    scene.tweens.add({ targets: dBanner, x: 0, duration: 180, ease: "Quad.easeOut" });
    scene.tweens.add({ targets: [aText, aClass, dText, dClass], alpha: 1, duration: 180, delay: 120 });
    // Slash-impact effect on the fx text.
    scene.tweens.add({
      targets: fx,
      alpha: 1,
      scale: 1,
      duration: 160,
      delay: 220,
      ease: "Back.easeOut",
    });
    // Hold, then slide everything off and clean up.
    scene.time.delayedCall(dur, () => {
      const cleanup = () => {
        dim.destroy();
        aBanner.destroy();
        dBanner.destroy();
        aText.destroy();
        aClass.destroy();
        dText.destroy();
        dClass.destroy();
        fx.destroy();
        resolve();
      };
      scene.tweens.add({ targets: aBanner, x: -W, duration: 160, ease: "Quad.easeIn" });
      scene.tweens.add({
        targets: dBanner,
        x: W,
        duration: 160,
        ease: "Quad.easeIn",
      });
      scene.tweens.add({
        targets: [aText, aClass, dText, dClass, fx, dim],
        alpha: 0,
        duration: 160,
        onComplete: cleanup,
      });
    });
  });
}
