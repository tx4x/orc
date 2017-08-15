/**
 * @module orc/constants
 */

'use strict';

module.exports = {

  /**
   * @constant {Number} AUDIT_BYTES - Number of bytes for audit challenge
   */
  AUDIT_BYTES: 32,

  /**
   * @constant {Number} CLEAN_INTERVAL - Interval for reaping stale shards
   */
  CLEAN_INTERVAL: 86400000,

  /**
   * @constant {Number} CONSIGN_THRESHOLD - Threshold for consign time
   */
  CONSIGN_THRESHOLD: 86400000,

  /**
   * @constant {Number} TOKEN_EXPIRE - Reject data token after time
   */
  TOKEN_EXPIRE: 1800000,

  /**
   * @constant MAX_NODE_INDEX - Maximum node index
   */
  MAX_NODE_INDEX: 0x7fffffff,

  /**
   * @constant HD_KEY_DERIVATION_PATH - Key derivation path for HD keys
   */
  HD_KEY_DERIVATION_PATH: 'm/3000\'/0\''

};
