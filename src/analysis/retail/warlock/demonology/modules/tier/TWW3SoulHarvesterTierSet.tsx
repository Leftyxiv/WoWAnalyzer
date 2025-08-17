import { formatNumber, formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { TIERS } from 'game/TIERS';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  ApplyBuffEvent,
  CastEvent,
  DamageEvent,
  RemoveBuffEvent,
  ResourceChangeEvent,
} from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';

/**
 * Manaforge Omega (TWW S3) Tier Set - Soul Harvester Hero Talent
 *
 * 2pc: Shadow of Death unleashes your demonic soul to assault your current target
 * for 12 sec, dealing Shadow damage to the target and enemies within 10 yds with each swipe.
 *
 * 4pc: Demonic Soul damage increased by 45% and Wicked Reaping damage increased by 45%.
 * Your demonic soul generates 1 Soul Shard every 3 sec while assaulting enemies.
 */
class TWW3SoulHarvesterTierSet extends Analyzer {
  has2Piece: boolean;
  has4Piece: boolean;

  // Tracking for 2pc
  shadowOfDeathCasts = 0;
  demonicSoulDamage = 0;
  demonicSoulHits = 0;
  demonicSoulActiveTime = 0;
  currentDemonicSoul: { start: number; end: number | null } | null = null;
  demonicSoulHistory: { start: number; end: number }[] = [];

  // Tracking for 4pc
  shardsGenerated = 0;
  shardsWasted = 0;
  shardGenerationEvents: number[] = [];

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
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.SHADOW_OF_DEATH_CAST),
      this.onShadowOfDeathCast,
    );
    this.addEventListener(
      Events.applybuff.to(SELECTED_PLAYER).spell(SPELLS.SHADOW_OF_DEATH_BUFF),
      this.onDemonicSoulStart,
    );
    this.addEventListener(
      Events.removebuff.from(SELECTED_PLAYER).spell(SPELLS.SHADOW_OF_DEATH_BUFF),
      this.onDemonicSoulEnd,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.DEMONIC_SOUL_DAMAGE),
      this.onDemonicSoulDamage,
    );

    // 4pc events - track soul shard generation
    if (this.has4Piece) {
      this.addEventListener(Events.resourcechange.by(SELECTED_PLAYER), this.onResourceChange);
    }
  }

  onShadowOfDeathCast(event: CastEvent) {
    this.shadowOfDeathCasts += 1;
  }

  onDemonicSoulStart(event: ApplyBuffEvent) {
    this.currentDemonicSoul = {
      start: event.timestamp,
      end: null,
    };
  }

  onDemonicSoulEnd(event: RemoveBuffEvent) {
    if (this.currentDemonicSoul) {
      this.currentDemonicSoul.end = event.timestamp;
      const duration = event.timestamp - this.currentDemonicSoul.start;
      this.demonicSoulActiveTime += duration;
      this.demonicSoulHistory.push({
        start: this.currentDemonicSoul.start,
        end: event.timestamp,
      });
      this.currentDemonicSoul = null;
    }
  }

  onDemonicSoulDamage(event: DamageEvent) {
    this.demonicSoulDamage += event.amount + (event.absorbed || 0);
    this.demonicSoulHits += 1;
  }

  onResourceChange(event: ResourceChangeEvent) {
    // Check if this is a soul shard gain during demonic soul
    if (
      event.resourceChangeType === RESOURCE_TYPES.SOUL_SHARDS.id &&
      event.changeType === 'gain' &&
      this.currentDemonicSoul
    ) {
      // Track the shard generation
      if (event.resourceChange && event.resourceChange > 0) {
        const shardsGained = event.resourceChange / 10; // Soul shards are stored as x10
        this.shardsGenerated += shardsGained;
        this.shardGenerationEvents.push(event.timestamp);

        // Check for waste (if at max shards)
        if (event.waste && event.waste > 0) {
          this.shardsWasted += event.waste / 10;
        }
      }
    }
  }

  get demonicSoulUptime() {
    return this.demonicSoulActiveTime / this.owner.fightDuration;
  }

  get averageDemonicSoulDuration() {
    if (this.demonicSoulHistory.length === 0) {
      return 0;
    }
    const totalDuration = this.demonicSoulHistory.reduce(
      (sum, soul) => sum + (soul.end - soul.start),
      0,
    );
    return totalDuration / this.demonicSoulHistory.length / 1000; // Convert to seconds
  }

  get demonicSoulDamagePerCast() {
    if (this.shadowOfDeathCasts === 0) {
      return 0;
    }
    return this.demonicSoulDamage / this.shadowOfDeathCasts;
  }

  get shardsGeneratedPerMinute() {
    const fightDurationMinutes = this.owner.fightDuration / 60000;
    return this.shardsGenerated / fightDurationMinutes;
  }

  get shardWastePercent() {
    const totalPotentialShards = this.shardsGenerated + this.shardsWasted;
    if (totalPotentialShards === 0) {
      return 0;
    }
    return this.shardsWasted / totalPotentialShards;
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(2)}
        size="flexible"
        category={STATISTIC_CATEGORY.ITEMS}
        tooltip={
          <>
            <strong>2-piece:</strong>
            <br />
            Shadow of Death Casts: {this.shadowOfDeathCasts}
            <br />
            Demonic Soul Uptime: {formatPercentage(this.demonicSoulUptime)}%
            <br />
            Average Duration: {this.averageDemonicSoulDuration.toFixed(1)}s
            <br />
            Total Hits: {this.demonicSoulHits}
            <br />
            Damage per Cast: {formatNumber(this.demonicSoulDamagePerCast)}
            <br />
            <br />
            {this.has4Piece && (
              <>
                <strong>4-piece:</strong>
                <br />
                Soul Shards Generated: {this.shardsGenerated.toFixed(1)}
                <br />
                Soul Shards Wasted: {this.shardsWasted.toFixed(1)} (
                {formatPercentage(this.shardWastePercent)}%)
                <br />
                Shards per Minute: {this.shardsGeneratedPerMinute.toFixed(1)}
              </>
            )}
          </>
        }
      >
        <BoringSpellValueText spell={SPELLS.SHADOW_OF_DEATH_CAST}>
          <ItemDamageDone amount={this.demonicSoulDamage} />
          <div>
            {formatPercentage(this.demonicSoulUptime)}% <small>Demonic Soul uptime</small>
          </div>
          {this.has4Piece && (
            <>
              <div>
                {this.shardsGenerated.toFixed(1)} <small>Soul Shards generated</small>
              </div>
              {this.shardsWasted > 0 && (
                <div>
                  {this.shardsWasted.toFixed(1)} <small>Soul Shards wasted</small>
                </div>
              )}
            </>
          )}
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default TWW3SoulHarvesterTierSet;
