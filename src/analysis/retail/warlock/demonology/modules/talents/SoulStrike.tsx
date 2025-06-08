import { formatThousands } from 'common/format';
import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/warlock';
import Analyzer, { Options, SELECTED_PLAYER_PET } from 'parser/core/Analyzer';
import Events, { DamageEvent } from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';

import SoulShardTracker from '../resources/SoulShardTracker';

class SoulStrike extends Analyzer {
  static dependencies = {
    soulShardTracker: SoulShardTracker,
  };

  soulShardTracker!: SoulShardTracker;
  damage = 0;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.SOUL_STRIKE_TALENT);
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER_PET).spell(SPELLS.SOUL_STRIKE_DAMAGE),
      this.handleSoulStrikeDamage,
    );
  }

  handleSoulStrikeDamage(event: DamageEvent) {
    this.damage += event.amount + (event.absorbed || 0);
  }

  statistic() {
    const shardsGained = this.soulShardTracker.getGeneratedBySpell(SPELLS.SOUL_STRIKE_SHARD_GEN.id);
    const shardsWasted = this.soulShardTracker.getWastedBySpell(SPELLS.SOUL_STRIKE_SHARD_GEN.id);
    return (
      <Statistic
        category={STATISTIC_CATEGORY.TALENTS}
        size="flexible"
        tooltip={
          <ul>
            <li>{formatThousands(this.damage)} damage</li>
            {shardsWasted > 0 && (
              <li>{shardsWasted.toFixed(1)} shards wasted due to overcapping</li>
            )}
          </ul>
        }
      >
        <BoringSpellValueText spell={TALENTS.SOUL_STRIKE_TALENT}>
          <ItemDamageDone amount={this.damage} />
          <ul>
            <li>{shardsGained} <small>Shards generated</small></li>
            {shardsWasted > 0 && (
              <li>{shardsWasted.toFixed(1)} <small>Shards wasted</small></li>
            )}
          </ul>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default SoulStrike;
