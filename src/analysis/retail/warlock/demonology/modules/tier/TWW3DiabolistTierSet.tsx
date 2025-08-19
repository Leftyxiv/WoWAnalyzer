import { formatNumber, formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import { TIERS } from 'game/TIERS';
import { WARLOCK_TWW3_ID } from 'common/ITEMS/dragonflight';
import ItemSetLink from 'interface/ItemSetLink';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  ApplyBuffEvent,
  CastEvent,
  DamageEvent,
  RefreshBuffEvent,
  RemoveBuffEvent,
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
  oculusExplosions = 0;
  oculusDamage = 0;
  handOfGuldanCasts = 0;
  fullPowerHandOfGuldanCasts = 0;

  // Tracking for 4pc
  intellectBuffStacks = 0;
  intellectBuffUptime = 0;
  intellectBuffApplications = 0;
  intellectBuffHistory: { start: number; end: number | null; stacks: number }[] = [];
  currentIntellectBuff: { start: number; end: number | null; stacks: number } | null = null;

  constructor(options: Options) {
    super(options);
    // Check if player has TWW3 tier set
    this.active = this.selectedCombatant.has2PieceByTier(TIERS.TWW3);
    this.has2Piece = this.active;
    this.has4Piece = this.selectedCombatant.has4PieceByTier(TIERS.TWW3);

    if (!this.active) {
      return;
    }

    // 2pc events
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.HAND_OF_GULDAN_CAST),
      this.onHandOfGuldan,
    );
    // Track Oculus buff applications (each buff = 1 full power HoG)
    this.addEventListener(
      Events.applybuff.to(SELECTED_PLAYER).spell(SPELLS.DEMONIC_OCULUS_BUFF),
      this.onOculusBuff,
    );
    // Track when Oculus buffs are removed (when they explode)
    this.addEventListener(
      Events.removebuff.to(SELECTED_PLAYER).spell(SPELLS.DEMONIC_OCULUS_BUFF),
      this.onOculusExplosion,
    );
    // Track when Demonic Art is consumed (buff removed from player)
    this.addEventListener(
      Events.removebuff.to(SELECTED_PLAYER).spell(SPELLS.DEMONIC_ART_BUFF),
      this.onDemonicArtConsume,
    );
    // Also track refreshes in case the buff is refreshed rather than removed
    this.addEventListener(
      Events.refreshbuff.to(SELECTED_PLAYER).spell(SPELLS.DEMONIC_ART_BUFF),
      this.onDemonicArtConsume,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.DEMONIC_OCULUS_EXPLOSION),
      this.onOculusDamage,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.EYE_BLAST),
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
        Events.removebuff.to(SELECTED_PLAYER).spell(SPELLS.OCULUS_INTELLECT_BUFF),
        this.onIntellectBuffRemove,
      );
    }
  }

  onHandOfGuldan(event: CastEvent) {
    // Track all Hand of Gul'dan casts
    this.handOfGuldanCasts += 1;
    // Full power casts are tracked via the Oculus buff application
  }

  onOculusBuff(event: ApplyBuffEvent) {
    // Each buff application means a full power (3-shard) Hand of Gul'dan was cast
    this.fullPowerHandOfGuldanCasts += 1;
    this.oculusSummons += 1;
    this.activeOculi = Math.min(this.activeOculi + 1, 3);
  }

  onOculusExplosion(event: RemoveBuffEvent) {
    // When an Oculus buff is removed, it explodes
    this.oculusExplosions += 1;
    if (this.activeOculi > 0) {
      this.activeOculi -= 1;
    }
  }

  onDemonicArtConsume(event: RemoveBuffEvent | RefreshBuffEvent) {
    // Track when Demonic Art triggers the explosions
    if (this.activeOculi > 0) {
      // Reset active count since they all explode at once
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
            Hand of Gul'dan Casts: {this.handOfGuldanCasts}
            <br />
            Full Power (3-shard) Casts: {this.fullPowerHandOfGuldanCasts}
            <br />
            Oculus Summons: {this.oculusSummons}
            <br />
            Total Explosions: {this.oculusExplosions}
            <br />
            {this.has4Piece && (
              <>
                <br />
                <strong>4-piece:</strong>
                <br />
                Intellect Buff Uptime: {formatPercentage(this.intellectBuffUptimePercent)}%
                <br />
                Average Intellect Increase: {(this.averageIntellectStacks * 2).toFixed(1)}%
              </>
            )}
          </>
        }
      >
        <BoringSpellValueText spell={SPELLS.DEMONIC_OCULUS_BUFF}>
          <small>
            <ItemSetLink id={WARLOCK_TWW3_ID}>TWW Season 3 Tier Set (Diabolist)</ItemSetLink>
          </small>
          <br />
          {formatNumber(this.oculusDamage)} <small>total damage</small>
          <br />
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
