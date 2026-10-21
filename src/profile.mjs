import {ROLE_DEFS, PRESETS, normalizeHex} from './color-engine.mjs';
import {DEFAULT_SETTINGS} from './diagram-renderer.mjs';
import {CORE_VERSION, MERMAID_VERSION} from './version.mjs';

export const PROFILE_SCHEMA = 'kobo.diagram-profile/v1';
const roleKeys = ROLE_DEFS.map(({key}) => key);
const compatibleCoreVersions = new Set(['0.1.0', '0.1.1', '0.1.2', '0.1.3']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  return value;
}

function knownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`Unsupported ${label} field: ${key}.`);
}

function rolesFor(input) {
  record(input, 'roles');
  knownKeys(input, roleKeys, 'roles');
  return Object.fromEntries(roleKeys.map(key => {
    const value = own(input, key) ? input[key] : PRESETS[0].roles[key];
    const color = normalizeHex(value);
    if (!color) throw new TypeError(`roles.${key} must be a 3 or 6 digit HEX color.`);
    return [key, color];
  }));
}

function settingsFor(input) {
  record(input, 'settings');
  knownKeys(input, Object.keys(DEFAULT_SETTINGS), 'settings');
  const output = {...DEFAULT_SETTINGS, ...input};
  for (const [key, minimum, maximum] of [['radius', 0, 20], ['lineWidth', 1, 3], ['fontSize', 14, 22]]) {
    if (typeof output[key] !== 'number' || !Number.isFinite(output[key]) || output[key] < minimum || output[key] > maximum) {
      throw new TypeError(`settings.${key} must be a finite number from ${minimum} to ${maximum}.`);
    }
  }
  for (const [key, choices] of [
    ['curve', ['basis', 'linear', 'stepAfter']],
    ['density', ['compact', 'comfortable', 'spacious']],
    ['direction', ['auto', 'TB', 'TD', 'BT', 'LR', 'RL']],
  ]) if (!choices.includes(output[key])) throw new TypeError(`Unsupported settings.${key}.`);
  if (typeof output.transparent !== 'boolean') throw new TypeError('settings.transparent must be a boolean.');
  return output;
}

function standardFor(input) {
  record(input, 'standard');
  knownKeys(input, ['name', 'version'], 'standard');
  const output = {};
  for (const [key, maximum] of [['name', 180], ['version', 80]]) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > maximum || /[\u0000-\u001f\u007f]/u.test(input[key])) {
      throw new TypeError(`standard.${key} must be nonempty text of at most ${maximum} characters.`);
    }
    output[key] = input[key].trim();
  }
  return output;
}

/** Create the restricted, serializable profile carried by storage and handoffs. */
export function createDiagramProfile(input = {}) {
  record(input, 'profile options');
  knownKeys(input, ['roles', 'settings', 'standard'], 'profile options');
  return validateDiagramProfile({schema: PROFILE_SCHEMA, engineVersion: MERMAID_VERSION, coreVersion: CORE_VERSION,
    roles: own(input, 'roles') ? input.roles : {}, settings: own(input, 'settings') ? input.settings : {}, ...(own(input, 'standard') ? {standard: input.standard} : {})});
}

/** Accept only explicitly compatible core versions; retain the saved version. */
export function validateDiagramProfile(input) {
  record(input, 'profile');
  knownKeys(input, ['schema', 'engineVersion', 'coreVersion', 'roles', 'settings', 'standard'], 'profile');
  if (input.schema !== PROFILE_SCHEMA) throw new TypeError('Unsupported diagram profile schema.');
  if (input.engineVersion !== MERMAID_VERSION) throw new TypeError(`Unsupported Mermaid version: ${input.engineVersion}.`);
  if (!compatibleCoreVersions.has(input.coreVersion)) throw new TypeError(`Unsupported core version: ${input.coreVersion}.`);
  const profile = {schema: PROFILE_SCHEMA, engineVersion: MERMAID_VERSION, coreVersion: input.coreVersion,
    roles: rolesFor(input.roles), settings: settingsFor(input.settings)};
  if (own(input, 'standard')) profile.standard = standardFor(input.standard);
  return profile;
}
