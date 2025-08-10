import { formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import { TIERS } from 'game/TIERS';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  ApplyBuffEvent,
  CastEvent,
  DamageEvent,
  RefreshBuffEvent,
  RemoveBuffEvent,
  SummonEvent,
} from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';

/**
 * Manaforge Omega (TWW S3) Tier Set - Diabolist Hero Talent
 *
 * 2pc: Hand of Gul'dan cast at full power summons a Demonic Oculus, up to 3.
 * Consuming Demonic Art flings your Demonic Oculi at your current target,
 * exploding for Fire damage to the target and nearby enemies.
 *
 * 4pc: Demonic Oculi analyze the battle while active and deliver information
 * to you as they explode, increasing your Intellect by 2% for 10 sec.
 */
class TWW3DiabolistTierSet extends Analyzer {
  has2Piece: boolean;
  has4Piece: boolean;

  // Tracking for 2pc
  oculusSummons = 0;
  activeOculi = 0;
  maxOculi = 0;
  oculusExplosions = 0;
  oculusDamage = 0;
  demonicArtConsumes = 0;
  oculiPerArt: number[] = [];

  // Tracking for 4pc
  intellectBuffStacks = 0;
  intellectBuffUptime = 0;
  intellectBuffApplications = 0;
  intellectBuffHistory: { start: number; end: number | null; stacks: number }[] = [];
  currentIntellectBuff: { start: number; end: number | null; stacks: number } | null = null;

  constructor(options: Options) {
    super(options);
    // Check if player has TWW3 tier set (will need to update TIERS enum)
    this.active = this.selectedCombatant.has2PieceByTier(TIERS.TWW3 ?? TIERS.TWW2);
    this.has2Piece = this.active;
    this.has4Piece = this.selectedCombatant.has4PieceByTier(TIERS.TWW3 ?? TIERS.TWW2);

    if (!this.active) {
      return;
    }

    // 2pc events
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.HAND_OF_GULDAN_CAST),
      this.onHandOfGuldan,
    );
    this.addEventListener(
      Events.summon.by(SELECTED_PLAYER).spell(SPELLS.DEMONIC_OCULUS_SUMMON),
      this.onOculusSummon,
    );
    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.DEMONIC_ART_BUFF),
      this.onDemonicArtConsume,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.DEMONIC_OCULUS_EXPLOSION),
      this.onOculusDamage,
    );

    // 4pc events
    if (this.has4Piece) {
      this.addEventListener(
        Events.applybuff.to(SELECTED_PLAYER).spell(SPELLS.OCULUS_INTELLECT_BUFF),
        this.onIntellectBuffApply,
      );
      this.addEventListener(
        Events.refreshbuff.to(SELECTED_PLAYER).spell(SPELLS.OCULUS_INTELLECT_BUFF),
        this.onIntellectBuffRefresh,
      );
      this.addEventListener(
        Events.removebuff.from(SELECTED_PLAYER).spell(SPELLS.OCULUS_INTELLECT_BUFF),
        this.onIntellectBuffRemove,
      );
    }
  }

  onHandOfGuldan(event: CastEvent) {
    // Check if it was a full power cast (3 shards)
    const resource = event.classResources?.find(
      (r) => r.type === 3, // Soul Shards resource type
    );
    if (resource && resource.cost && resource.cost >= 30) {
      // Full power HoG costs 3 shards (30 in raw value)
      // Oculus summon is handled by summon event
    }
  }

  onOculusSummon(event: SummonEvent) {
    this.oculusSummons += 1;
    this.activeOculi = Math.min(this.activeOculi + 1, 3);
    if (this.activeOculi > this.maxOculi) {
      this.maxOculi = this.activeOculi;
    }
  }

  onDemonicArtConsume(event: RemoveBuffEvent) {
    if (this.activeOculi > 0) {
      this.demonicArtConsumes += 1;
      this.oculiPerArt.push(this.activeOculi);
      this.oculusExplosions += this.activeOculi;
      this.activeOculi = 0;
    }
  }

  onOculusDamage(event: DamageEvent) {
    this.oculusDamage += event.amount + (event.absorbed || 0);
  }

  onIntellectBuffApply(event: ApplyBuffEvent) {
    this.intellectBuffApplications += 1;
    this.intellectBuffStacks = 1;
    this.currentIntellectBuff = {
      start: event.timestamp,
      end: null,
      stacks: 1,
    };
    this.intellectBuffHistory.push(this.currentIntellectBuff);
  }

  onIntellectBuffRefresh(event: RefreshBuffEvent) {
    this.intellectBuffStacks = Math.min(this.intellectBuffStacks + 1, 10); // Assuming max 10 stacks
    if (this.currentIntellectBuff) {
      this.currentIntellectBuff.stacks = this.intellectBuffStacks;
    }
  }

  onIntellectBuffRemove(event: RemoveBuffEvent) {
    if (this.currentIntellectBuff) {
      this.currentIntellectBuff.end = event.timestamp;
      this.currentIntellectBuff = null;
    }
    this.intellectBuffStacks = 0;
  }

  get averageOculiPerArt() {
    if (this.oculiPerArt.length === 0) {
      return 0;
    }
    return this.oculiPerArt.reduce((a, b) => a + b, 0) / this.oculiPerArt.length;
  }

  get intellectBuffUptimePercent() {
    let totalUptime = 0;
    this.intellectBuffHistory.forEach((buff) => {
      const end = buff.end || this.owner.currentTimestamp;
      totalUptime += end - buff.start;
    });
    return totalUptime / this.owner.fightDuration;
  }

  get averageIntellectStacks() {
    let weightedSum = 0;
    let totalDuration = 0;

    this.intellectBuffHistory.forEach((buff) => {
      const end = buff.end || this.owner.currentTimestamp;
      const duration = end - buff.start;
      weightedSum += buff.stacks * duration;
      totalDuration += duration;
    });

    return totalDuration > 0 ? weightedSum / totalDuration : 0;
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(1)}
        size="flexible"
        category={STATISTIC_CATEGORY.ITEMS}
        tooltip={
          <>
            <strong>2-piece:</strong>
            <br />
            Oculus Summons: {this.oculusSummons}
            <br />
            Demonic Art Consumes: {this.demonicArtConsumes}
            <br />
            Total Explosions: {this.oculusExplosions}
            <br />
            Average Oculi per Art: {this.averageOculiPerArt.toFixed(2)}
            <br />
            Max Oculi at once: {this.maxOculi}
            <br />
            <br />
            {this.has4Piece && (
              <>
                <strong>4-piece:</strong>
                <br />
                Intellect Buff Applications: {this.intellectBuffApplications}
                <br />
                Intellect Buff Uptime: {formatPercentage(this.intellectBuffUptimePercent)}%
                <br />
                Average Intellect Stacks: {this.averageIntellectStacks.toFixed(1)}
                <br />
                Average Intellect Increase: {(this.averageIntellectStacks * 2).toFixed(1)}%
              </>
            )}
          </>
        }
      >
        <BoringSpellValueText spell={SPELLS.DEMONIC_OCULUS_SUMMON}>
          <div>
            {this.averageOculiPerArt.toFixed(1)} <small>avg. Oculi per Demonic Art</small>
          </div>
          <ItemDamageDone amount={this.oculusDamage} />
          {this.has4Piece && (
            <div>
              {formatPercentage(this.intellectBuffUptimePercent)}%{' '}
              <small>Intellect buff uptime</small>
            </div>
          )}
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default TWW3DiabolistTierSet;
