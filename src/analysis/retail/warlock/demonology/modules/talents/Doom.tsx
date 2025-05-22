import { defineMessage } from '@lingui/core/macro';
import { formatPercentage, formatThousands, formatNumber } from 'common/format';
import React from 'react';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warlock';
import { SpellLink } from 'interface';
import UptimeIcon from 'interface/icons/Uptime';
import SpellIcon from 'interface/SpellIcon';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { ApplyDebuffEvent, DamageEvent, RemoveDebuffEvent, CastEvent } from 'parser/core/Events';
import { ThresholdStyle, When } from 'parser/core/ParseResults';
import Enemies from 'parser/shared/modules/Enemies';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import StatisticBar from 'parser/ui/StatisticBar';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import UptimeBar from 'parser/ui/UptimeBar';

class Doom extends Analyzer {
  static dependencies = {
    enemies: Enemies,
  };
  enemies!: Enemies;

  doom = {
    applyDebuffCount: 0,
    removeDebuffCount: 0,
    damage: 0,
    hits: 0,
  };

  demonboltCasts = 0;
  demonboltWithCoreCasts = 0;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.DOOM_TALENT);
    
    this.addEventListener(
      Events.applydebuff.by(SELECTED_PLAYER).spell(SPELLS.DOOM_DEBUFF),
      this.onDoomApply,
    );
    this.addEventListener(
      Events.removedebuff.by(SELECTED_PLAYER).spell(SPELLS.DOOM_DEBUFF),
      this.onDoomRemove,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.DOOM_DAMAGE),
      this.onDoomDamage,
    );
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.DEMONBOLT),
      this.onDemonboltCast,
    );
  }

  onDoomApply(event: ApplyDebuffEvent) {
    this.doom.applyDebuffCount += 1;
  }

  onDoomRemove(event: RemoveDebuffEvent) {
    this.doom.removeDebuffCount += 1;
  }

  onDoomDamage(event: DamageEvent) {
    this.doom.hits += 1;
    this.doom.damage += event.amount + (event.absorbed || 0);
  }

  onDemonboltCast(event: CastEvent) {
    this.demonboltCasts += 1;
    
    // Check if player has Demonic Core buff when casting Demonbolt
    if (this.selectedCombatant.hasBuff(SPELLS.DEMONIC_CORE_BUFF.id, event.timestamp)) {
      this.demonboltWithCoreCasts += 1;
    }
  }

  get uptime() {
    return this.enemies.getBuffUptime(SPELLS.DOOM_DEBUFF.id) / this.owner.fightDuration;
  }

  get doomHitsPerExpire() {
    return this.doom.removeDebuffCount > 0 ? this.doom.hits / this.doom.removeDebuffCount : 0;
  }

  get doomDamagePerExpire() {
    return this.doom.removeDebuffCount > 0 ? this.doom.damage / this.doom.removeDebuffCount : 0;
  }

  get doomApplicationRate() {
    return this.demonboltWithCoreCasts > 0 ? this.doom.applyDebuffCount / this.demonboltWithCoreCasts : 0;
  }

  get suggestionThresholds() {
    return {
      actual: this.uptime,
      isLessThan: {
        minor: 0.95,
        average: 0.9,
        major: 0.8,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  suggestions(when: When) {
    when(this.suggestionThresholds).addSuggestion((suggest, actual, recommended) =>
      suggest(
        <>
          Your <SpellLink spell={TALENTS.DOOM_TALENT} /> uptime can be improved. Doom is a 20-second debuff automatically applied by <SpellLink spell={SPELLS.DEMONBOLT} /> when it consumes a <SpellLink spell={SPELLS.DEMONIC_CORE_BUFF} />, so maintaining high uptime requires consistent Demonic Core generation and usage.
        </>,
      )
        .icon(TALENTS.DOOM_TALENT.icon)
        .actual(
          defineMessage({
            id: 'warlock.demonology.suggestions.doom.uptime',
            message: `${formatPercentage(actual)}% Doom uptime`,
          }),
        )
        .recommended(`>${formatPercentage(recommended)}% is recommended`),
    );
  }

  statistic() {
    return (
      <>
        <StatisticBar wide position={STATISTIC_ORDER.CORE(1)}>
          <div className="flex">
            <div className="flex-sub icon">
              <SpellIcon spell={TALENTS.DOOM_TALENT} />
            </div>
            <div className="flex-sub value" style={{ width: 140 }}>
              {formatPercentage(this.uptime, 0)}% <small>uptime</small>
            </div>
            <div className="flex-main chart" style={{ padding: 10 }}>
              <UptimeBar
                uptimeHistory={this.enemies.getDebuffHistory(SPELLS.DOOM_DEBUFF.id)}
                start={this.owner.fight.start_time}
                end={this.owner.fight.end_time}
              />
            </div>
          </div>
        </StatisticBar>
        <Statistic
          category={STATISTIC_CATEGORY.TALENTS}
          size="flexible"
          position={STATISTIC_ORDER.CORE(2)}
          tooltip={
            <>
              <p>
                Uptime should be as high as possible {'>'} 95%. Doom is a 20-second debuff automatically applied by Demonbolt when it consumes a Demonic Core and is one of your main Soul Shard generators.
              </p>
              <p>Doom applications: {this.doom.applyDebuffCount}</p>
              <p>Demonbolt casts: {this.demonboltCasts}</p>
              <p>Demonbolt with Core: {this.demonboltWithCoreCasts}</p>
              <p>Application rate: {formatPercentage(this.doomApplicationRate)}%</p>
              <p>Doom hits: {this.doom.hits}</p>
              <p>Avg. damage per Doom expire: {formatNumber(this.doomDamagePerExpire)}</p>
              {this.doomHitsPerExpire > 1 && (
                <p>Avg. hits per Doom expire: {this.doomHitsPerExpire.toFixed(1)}</p>
              )}
            </>
          }
        >
          <BoringSpellValueText spell={TALENTS.DOOM_TALENT}>
            <ItemDamageDone amount={this.doom.damage} />
            <br />
            <UptimeIcon /> {formatPercentage(this.uptime)}% <small>Uptime</small>
            <br />
            {this.doom.removeDebuffCount} <small>Dooms expired</small>
          </BoringSpellValueText>
        </Statistic>
      </>
    );
  }
}

export default Doom;
