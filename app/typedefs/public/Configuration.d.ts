import type { DeepPartial } from '@typedefs/internal/Generics.js';
import type {
  InternalCorsDisabledConfiguration,
  InternalCorsEnabledConfiguration,
  InternalServerConfiguration,
} from '@typedefs/internal/InternalConfiguration.js';

/**
 * User-facing configuration interface where all properties are optional
 * Users only need to specify what they want to override from defaults
 *
 * This is created by making the complete internal ServerConfigurationShape partially optional
 */
export type ServerConfiguration = DeepPartial<InternalServerConfiguration>;

/**
 * CORS Configuration Options
 * Provides fine-grained control over Cross-Origin Resource Sharing
 */
export type CorsConfiguration = InternalCorsDisabledConfiguration | InternalCorsEnabledConfiguration;
