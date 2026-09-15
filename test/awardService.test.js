import { describe, it, expect } from 'vitest';
import { calculateGroupLegacyStats } from '../src/services/awardService.js';

describe('Award Service - Group Legacy Deduplication', () => {
  
  it('Should accurately count direct wins and deduplicate member wins (Best Duo case)', () => {
    const groupId = 'group_txt_001';
    const yeonjunId = 'idol_yeonjun';
    const soobinId = 'idol_soobin';
    const groupMemberIds = [yeonjunId, soobinId];

    const directAwards = [
      { id: 'award_001', winnerIds: [groupId], categoryId: 'cat_daesang_goty' }
    ];

    const memberAwards = [
      { id: 'award_002', winnerIds: [yeonjunId], categoryId: 'cat_reg_dancer' },
      { id: 'award_003', winnerIds: [yeonjunId, soobinId], categoryId: 'cat_reg_best_duo' } 
    ];

    const stats = calculateGroupLegacyStats(directAwards, memberAwards, groupMemberIds);

    expect(stats.directWins).toBe(1); 
    expect(stats.associatedMemberWins).toBe(2); 
    expect(stats.totalLegacyAwards).toBe(3);
  });
});