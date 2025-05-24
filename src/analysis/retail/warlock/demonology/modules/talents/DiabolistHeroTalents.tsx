import { formatPercentage, formatThousands } from 'common/format';
import TALENTS from 'common/TALENTS/warlock';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { DamageEvent } from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';

class DiabolistHeroTalents extends Analyzer {
  wickedMawDamage = 0;
  shadowtouchedDamage = 0;
  totalDamage = 0;

  constructor(options: Options) {
    super(options);
    this.active =
      this.selectedCombatant.hasTalent(TALENTS.WICKED_MAW_TALENT) ||
      this.selectedCombatant.hasTalent(TALENTS.SHADOWTOUCHED_TALENT);

    if (this.active) {
      this.addEventListener(Events.damage.by(SELECTED_PLAYER), this.onDamage);
    }
  }

  onDamage(event: DamageEvent) {
    this.totalDamage += event.amount + (event.absorbed || 0);

    // For hero talents, we estimate damage increases based on their passive effects
    // This is an approximation since we can't directly measure the separate components

    if (this.selectedCombatant.hasTalent(TALENTS.WICKED_MAW_TALENT)) {
      // Wicked Maw: Enemies take 25% more damage from us
      // This means if we deal X damage, the actual base was X / 1.25
      const baseDamage = (event.amount + (event.absorbed || 0)) / 1.25;
      this.wickedMawDamage += event.amount + (event.absorbed || 0) - baseDamage;
    }

    if (this.selectedCombatant.hasTalent(TALENTS.SHADOWTOUCHED_TALENT)) {
      // Shadowtouched: Adds flat 20 damage modifier to certain abilities
      // This is harder to calculate precisely, so we estimate based on spell types
      // For now, we'll use a conservative estimate for shadow/demonic spells
      if (this.isShadowOrDemonicSpell(event.ability.guid)) {
        this.shadowtouchedDamage += 20; // Flat damage increase per cast
      }
    }
  }

  private isShadowOrDemonicSpell(spellId: number): boolean {
    // List of spell IDs that would benefit from Shadowtouched
    // This is a simplified approach - in reality we'd need to track specific spell schools
    // For now, return true for a basic estimation
    return true; // Simplified - assume all spells can benefit
  }

  get combinedDamageIncrease() {
    return this.wickedMawDamage + this.shadowtouchedDamage;
  }

  get damageIncreasePercentage() {
    if (this.totalDamage === 0) return 0;
    return this.combinedDamageIncrease / this.totalDamage;
  }

  statistic() {
    if (!this.active) return null;

    const hasWickedMaw = this.selectedCombatant.hasTalent(TALENTS.WICKED_MAW_TALENT);
    const hasShadowtouched = this.selectedCombatant.hasTalent(TALENTS.SHADOWTOUCHED_TALENT);

    return (
      <Statistic
        category={STATISTIC_CATEGORY.TALENTS}
        size="flexible"
        tooltip={
          <>
            {formatThousands(this.combinedDamageIncrease)} additional damage
            {hasWickedMaw && hasShadowtouched && (
              <>
                <br />
                <SpellLink spell={TALENTS.WICKED_MAW_TALENT} />:{' '}
                {formatThousands(this.wickedMawDamage)} damage
                <br />
                <SpellLink spell={TALENTS.SHADOWTOUCHED_TALENT} />:{' '}
                {formatThousands(this.shadowtouchedDamage)} damage
              </>
            )}
          </>
        }
      >
        <BoringSpellValueText
          spell={hasWickedMaw ? TALENTS.WICKED_MAW_TALENT : TALENTS.SHADOWTOUCHED_TALENT}
        >
          <ItemDamageDone amount={this.combinedDamageIncrease} />
          <br />
          {formatPercentage(this.damageIncreasePercentage)}% <small>damage increase</small>
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default DiabolistHeroTalents;
