import type { Reflection, MemorySummary } from '../types';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Memory Layer (Layer D)
 * Processes reflections to update user-specific patterns and biases.
 */
export async function updateMemoryFromReflection(uid: string, reflection: Reflection) {
  const memoryRef = doc(db, 'memories', uid);
  const memorySnap = await getDoc(memoryRef);

  let memory: MemorySummary;
  if (!memorySnap.exists()) {
    memory = {
      uid,
      preferredFirstBlockTypes: [],
      lowAccuracyPatterns: [],
      highAccuracyPatterns: [],
      commonDerailers: [],
      averageFollowThrough: reflection.followedIt === 'yes' ? 1.0 : (reflection.followedIt === 'partially' ? 0.5 : 0),
      recentProtocolCount: 1,
      updatedAt: new Date().toISOString()
    };
  } else {
    memory = memorySnap.data() as MemorySummary;

    // Update follow-through average
    const fVal = reflection.followedIt === 'yes' ? 1.0 : (reflection.followedIt === 'partially' ? 0.5 : 0);
    memory.averageFollowThrough = (memory.averageFollowThrough * memory.recentProtocolCount + fVal) / (memory.recentProtocolCount + 1);
    memory.recentProtocolCount += 1;


    // Rule 1: Accuracy Tracking
    if (reflection.feltAccurate <= 2) {
      memory.lowAccuracyPatterns.push(`accuracy_${reflection.feltAccurate}_at_${reflection.date}`);
    } else if (reflection.feltAccurate >= 4) {
      memory.highAccuracyPatterns.push(`high_engagement_${reflection.date}`);
    }

    // Rule 2: Derailer Catching
    if (reflection.gotInWay) {
      const derailer = reflection.gotInWay.toLowerCase();
      if (derailer.includes('phone') || derailer.includes('scroll') || derailer.includes('message')) {
        if (!memory.commonDerailers.includes('phone_use')) memory.commonDerailers.push('phone_use');
      }
      if (derailer.includes('time') || derailer.includes('late') || derailer.includes('hurry')) {
        if (!memory.commonDerailers.includes('time_pressure')) memory.commonDerailers.push('time_pressure');
      }
    }

    // Rule 3: Favorite Blocks
    if (reflection.helpedMost && reflection.feltAccurate >= 4) {
      const helper = reflection.helpedMost.toLowerCase();
      if (helper.includes('breath') || helper.includes('ground')) {
        memory.preferredFirstBlockTypes.push('ground');
      } else if (helper.includes('move') || helper.includes('physical')) {
        memory.preferredFirstBlockTypes.push('ignite');
      }
    }

    memory.updatedAt = new Date().toISOString();
  }

  await setDoc(memoryRef, memory);
}
