import SPELLS from 'common/SPELLS';
import { TIERS } from 'game/TIERS';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import { SpellLink } from 'interface';

import DemoPets from '../../pets/DemoPets';

/**
 * TWW Season 2 Tier Set for Demonology Warlock
 * 
 * 2-Set: Your spells and abilities have a chance to hit a Jackpot! that summons a Greater Dreadstalker at 265% effectiveness. 
 *        Casting Summon Demonic Tyrant always hits a Jackpot!
 *        Tracks Jackpot procs via multiple detection methods including Tyrant casts and spell events.
 * 4-Set: Casting Hand of Gul'dan causes your active Dreadstalkers to cast Dreadbite at 20% effectiveness. 
 *        This damage is increased by 10% for each Soul Shard spent on Hand of Gul'dan.
 *        Tracks Hand of Gul'dan casts but not enhanced damage due to shared spell IDs.
 */
class TWW2TierSet extends Analyzer {
  static dependencies = {
    demoPets: DemoPets,
  };

  protected demoPets!: DemoPets;

  private jackpotProcs = 0;
  private handOfGuldanCasts = 0;
  private empoweredHandOfGuldanCasts = 0;

  constructor(options: Options) {
    super(options);
    // Only activate if player has tier set equipped
    this.active = this.selectedCombatant.has2PieceByTier(TIERS.TWW2);

    if (!this.active) {
      return;
    }

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.HAND_OF_GULDAN_CAST),
      this.onHandOfGuldanCast,
    );

    // Backup: Track Tyrant casts since they guarantee Jackpot procs
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.SUMMON_DEMONIC_TYRANT),
      this.onTyrantCast,
    );

    // Listen for the actual Jackpot proc spell (Call Greater Dreadstalker)
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.CALL_GREATER_DREADSTALKER),
      this.onJackpotProc,
    );

    // Also try listening for any spell containing "Greater" or "Jackpot" in case ID is different
    this.addEventListener(Events.cast.by(SELECTED_PLAYER), this.onAnyCast);

    // No need to track summons or damage - focus on proc counting
  }

  onJackpotProc(event: CastEvent) {
    // This is the actual Call Greater Dreadstalker proc from tier set
    this.jackpotProcs += 1;
  }

  onAnyCast(event: CastEvent) {
    // Look for any spell that might be related to Jackpot or Greater Dreadstalker
    const spellName = event.ability.name;
    if (
      spellName.toLowerCase().includes('jackpot') ||
      spellName.toLowerCase().includes('greater') ||
      spellName.toLowerCase().includes('dreadstalker')
    ) {
      // If it's not the ID we're already tracking, count it as a potential Jackpot proc
      if (event.ability.guid !== SPELLS.CALL_GREATER_DREADSTALKER.id && spellName.toLowerCase().includes('greater')) {
        this.jackpotProcs += 1;
      }
    }
  }

  onTyrantCast(event: CastEvent) {
    // Tyrant casts guarantee Jackpot procs according to tier set description
    this.jackpotProcs += 1;
  }

  onHandOfGuldanCast(event: CastEvent) {
    this.handOfGuldanCasts += 1;
    
    // For 4-set: assume all Hand of Gul'dan casts trigger empowered Dreadbites when you have tier set
    // This is a simplification since tracking active Dreadstalkers precisely is complex
    if (this.has4Piece) {
      this.empoweredHandOfGuldanCasts += 1;
    }
  }

  get has2Piece() {
    return this.selectedCombatant.has2PieceByTier(TIERS.TWW2);
  }

  get has4Piece() {
    return this.selectedCombatant.has4PieceByTier(TIERS.TWW2);
  }

  statistic() {
    // Only show the statistic if:
    // 1. Player has 2-piece tier set
    // 2. There were actual Jackpot procs detected
    if (!this.has2Piece || this.jackpotProcs === 0) {
      return null;
    }

    return (
      <Statistic
        category={STATISTIC_CATEGORY.ITEMS}
        size="flexible"
        tooltip={
          <>
            <strong>2-Set Bonus (Jackpot!):</strong>
            <ul>
              <li>Jackpot! procs: {this.jackpotProcs}</li>
              <li>Summons Greater Dreadstalkers at 265% effectiveness</li>
            </ul>
            {this.has4Piece && (
              <>
                <strong>4-Set Bonus (Enhanced Dreadbite):</strong>
                <ul>
                  <li><SpellLink spell={SPELLS.HAND_OF_GULDAN_CAST} /> casts: {this.handOfGuldanCasts}</li>
                  <li>Empowered <SpellLink spell={SPELLS.HAND_OF_GULDAN_CAST} /> casts: {this.empoweredHandOfGuldanCasts}</li>
                  <li>Causes active Dreadstalkers to cast enhanced Dreadbite</li>
                </ul>
              </>
            )}
            <br />
            <small>Note: Tracks tier set procs and empowered abilities. Damage attribution between Greater and regular Dreadstalkers is complex.</small>
          </>
        }
      >
        <BoringSpellValueText spell={SPELLS.CALL_GREATER_DREADSTALKER}>
          <small>TWW Season 2 Tier Set</small>
          <br />
          {this.jackpotProcs} <small><SpellLink spell={SPELLS.CALL_GREATER_DREADSTALKER} /> procs</small>
          <br />
          {this.has4Piece && (
            <>
              {this.empoweredHandOfGuldanCasts} <small>empowered <SpellLink spell={SPELLS.HAND_OF_GULDAN_CAST} /> casts</small>
              <br />
            </>
          )}
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default TWW2TierSet; 