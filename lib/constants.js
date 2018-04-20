/**
 * @module orc/constants
 */

'use strict';

module.exports = {

  /**
   * @constant {number} AUDIT_BYTES - Number of bytes for audit challenge
   */
  AUDIT_BYTES: 32,

  /**
   * @constant {number} CLEAN_INTERVAL - Interval for reaping stale shards
   */
  CLEAN_INTERVAL: 86400000,

  /**
   * @constant {number} CONSIGN_THRESHOLD - Threshold for consign time
   */
  CONSIGN_THRESHOLD: 86400000,

  /**
   * @constant {number} TOKEN_EXPIRE - Reject data token after time
   */
  TOKEN_EXPIRE: 1800000,

  /**
   * @constant {number }MAX_NODE_INDEX - Maximum node index
   */
  MAX_NODE_INDEX: 0x7fffffff,

  /**
   * @constant {string} HD_KEY_DERIVATION_PATH - Key derivation path for HD key
   */
  HD_KEY_DERIVATION_PATH: 'm/3000\'/0\'',

  /**
   * @constant {number} AUDIT_INTERVAL - Time interval for audit check
   */
  AUDIT_INTERVAL: 10800000,

  /**
   * @constant {number} SCORE_INTERVAL - Time to score for reputation
   */
  SCORE_INTERVAL: 604800000,

  /**
   * @constant {number} REAPER_GRACE - Grace period beyond score interval
   */
  REAPER_GRACE: 604800000,

  /**
   * @constant {number} NUM_CHALLENGES - Total challenges to generate per object
   */
  NUM_CHALLENGES: 12,

  /**
   * @constant {number} MAX_DECAY - Threshold for object decay for rebuilting
   */
  MAX_DECAY: 0.15

};
