import SPELLS from 'common/SPELLS';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { ResourceChangeEvent, EventType } from 'parser/core/Events';
import { Options } from 'parser/core/Module';
import SoulShardTracker from './SoulShardTracker';

interface MockCombatLogParser {
  currentTimestamp: number;
  fight: { start_time: number; end_time: number };
  selectedCombatant: {
    hasBuff: jest.MockedFunction<(buffId?: number) => boolean>;
  };
  formatTimestamp: jest.MockedFunction<(timestamp: number) => string>;
}

describe('SoulShardTracker', () => {
  let tracker: SoulShardTracker;
  let mockCombatLogParser: MockCombatLogParser;

  beforeEach(() => {
    // Mock the necessary dependencies
    mockCombatLogParser = {
      currentTimestamp: 1000,
      fight: { start_time: 0, end_time: 10000 },
      selectedCombatant: {
        hasBuff: jest.fn(() => false),
      },
      formatTimestamp: jest.fn((timestamp) => `${timestamp}ms`),
    };

    // Create tracker instance with mocked dependencies
    tracker = new SoulShardTracker({
      owner: mockCombatLogParser,
    } as Options);

    // Initialize the resource tracker
    tracker.resource = RESOURCE_TYPES.SOUL_SHARDS;
    tracker.maxResource = 5;
  });

  describe('onEnergize', () => {
    it('should correctly scale down soul shard gains from tenths to whole shards', () => {
      const mockEvent: ResourceChangeEvent = {
        type: EventType.ResourceChange,
        timestamp: 1000,
        sourceID: 1,
        targetID: 1,
        ability: {
          guid: SPELLS.SOUL_STRIKE_SHARD_GEN.id,
          name: 'Soul Strike',
          abilityIcon: 'inv_polearm_2h_fellord_04',
        },
        resourceChange: 10, // 1 shard in tenths
        waste: 0,
        resourceChangeType: RESOURCE_TYPES.SOUL_SHARDS.id,
        classResources: [
          {
            type: RESOURCE_TYPES.SOUL_SHARDS.id,
            amount: 20, // 2 shards in tenths after gain
            max: 50, // 5 shards in tenths
          },
        ],
      };

      // Spy on the super.onEnergize to check if it receives scaled values
      const superOnEnergizeSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(tracker)),
        'onEnergize',
      );

      tracker.onEnergize(mockEvent);

      // Verify the classResources were scaled down
      expect(mockEvent.classResources![0].amount).toBe(2); // 20/10 = 2
      expect(mockEvent.classResources![0].max).toBe(5); // 50/10 = 5
      expect(superOnEnergizeSpy).toHaveBeenCalledWith(mockEvent);
    });

    it('should correctly handle Soul Strike shard generation without waste', () => {
      const mockEvent: ResourceChangeEvent = {
        type: EventType.ResourceChange,
        timestamp: 1000,
        sourceID: 1,
        targetID: 1,
        ability: {
          guid: SPELLS.SOUL_STRIKE_SHARD_GEN.id,
          name: 'Soul Strike',
          abilityIcon: 'inv_polearm_2h_fellord_04',
        },
        resourceChange: 10, // 1 shard gained in tenths
        waste: 0, // no waste
        resourceChangeType: RESOURCE_TYPES.SOUL_SHARDS.id,
        classResources: [
          {
            type: RESOURCE_TYPES.SOUL_SHARDS.id,
            amount: 30, // 3 shards after gain in tenths
            max: 50, // 5 shards max in tenths
          },
        ],
      };

      // Mock getAdjustedGain to verify it's called and returns scaled values
      const adjustedGainSpy = jest.spyOn(tracker, 'getAdjustedGain');

      tracker.onEnergize(mockEvent);

      // Verify getAdjustedGain was called and returned correct values
      expect(adjustedGainSpy).toHaveBeenCalledWith(mockEvent);
      expect(adjustedGainSpy).toHaveReturnedWith({
        gain: 1, // (10 - 0)/10 = 1
        waste: 0, // 0/10 = 0
      });
    });

    it('should correctly handle Soul Strike shard generation with overcap waste', () => {
      const mockEvent: ResourceChangeEvent = {
        type: EventType.ResourceChange,
        timestamp: 1000,
        sourceID: 1,
        targetID: 1,
        ability: {
          guid: SPELLS.SOUL_STRIKE_SHARD_GEN.id,
          name: 'Soul Strike',
          abilityIcon: 'inv_polearm_2h_fellord_04',
        },
        resourceChange: 10, // 1 shard attempted in tenths
        waste: 10, // 1 shard wasted in tenths (player was at cap)
        resourceChangeType: RESOURCE_TYPES.SOUL_SHARDS.id,
        classResources: [
          {
            type: RESOURCE_TYPES.SOUL_SHARDS.id,
            amount: 50, // 5 shards (still at cap) in tenths
            max: 50, // 5 shards max in tenths
          },
        ],
      };

      // Mock getAdjustedGain to verify it's called and returns scaled values
      const adjustedGainSpy = jest.spyOn(tracker, 'getAdjustedGain');

      tracker.onEnergize(mockEvent);

      // Verify getAdjustedGain was called and returned scaled values
      expect(adjustedGainSpy).toHaveBeenCalledWith(mockEvent);
      expect(adjustedGainSpy).toHaveReturnedWith({
        gain: 0, // (10 - 10)/10 = 0
        waste: 1, // 10/10 = 1
      });
    });
  });

  describe('getAdjustedGain', () => {
    it('should divide gain and waste by 10 for normal generation', () => {
      const mockEvent: ResourceChangeEvent = {
        type: EventType.ResourceChange,
        timestamp: 1000,
        sourceID: 1,
        targetID: 1,
        ability: {
          guid: SPELLS.SOUL_STRIKE_SHARD_GEN.id,
          name: 'Soul Strike',
          abilityIcon: 'inv_polearm_2h_fellord_04',
        },
        resourceChange: 10, // 1 shard in tenths
        waste: 0, // no waste
        resourceChangeType: RESOURCE_TYPES.SOUL_SHARDS.id,
      };

      const result = tracker.getAdjustedGain(mockEvent);

      expect(result.gain).toBe(1); // (10 - 0)/10 = 1
      expect(result.waste).toBe(0); // 0/10 = 0
    });

    it('should divide gain and waste by 10 for overcapped generation', () => {
      const mockEvent: ResourceChangeEvent = {
        type: EventType.ResourceChange,
        timestamp: 1000,
        sourceID: 1,
        targetID: 1,
        ability: {
          guid: SPELLS.SOUL_STRIKE_SHARD_GEN.id,
          name: 'Soul Strike',
          abilityIcon: 'inv_polearm_2h_fellord_04',
        },
        resourceChange: 10, // 1 shard attempted in tenths
        waste: 10, // 1 shard wasted in tenths
        resourceChangeType: RESOURCE_TYPES.SOUL_SHARDS.id,
      };

      const result = tracker.getAdjustedGain(mockEvent);

      expect(result.gain).toBe(0); // (10 - 10)/10 = 0
      expect(result.waste).toBe(1); // 10/10 = 1
    });
  });
});
