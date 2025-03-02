import { assertThat } from 'hamjest';
import { evalProfilesYmlJinjaEnvVar } from '../../utils/JinjaUtils';

describe('JinjaUtils', () => {
  it('evalJinjaEnvVar should not replace value if it is not exist in environment', () => {
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{ env_var("TEST1") }}', '{{ env_var("TEST1") }}');
  });

  it('evalJinjaEnvVar should replace value if it is found in environment', () => {
    process.env['TEST2'] = 'test2_value';
    process.env['TEST3'] = 'test3_value';
    evalJinjaEnvVarShouldReturnEnvironmentValue("{{env_var('TEST2')}}", 'test2_value');
    evalJinjaEnvVarShouldReturnEnvironmentValue("{{env_var('TEST2')}}_{{env_var('TEST3')}}", 'test2_value_test3_value');
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{env_var("TEST2")}}', 'test2_value');
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{ env_var("TEST2") }}', 'test2_value');
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{ env_var("TEST2")   }}', 'test2_value');
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{   env_var("TEST2")   }}', 'test2_value');
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{   env_var("TEST2")   }}_b', 'test2_value_b');
    evalJinjaEnvVarShouldReturnEnvironmentValue('a_{{   env_var("TEST2")   }}_b', 'a_test2_value_b');

    evalJinjaEnvVarShouldReturnEnvironmentValue('{{ env_var("TEST1", "default") }}', 'default');
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{ env_var("TEST1", "default") }}_{{ env_var("TEST1", "default") }}', 'default_default');
    evalJinjaEnvVarShouldReturnEnvironmentValue("{{ env_var('TEST1', 'default') }}", 'default');
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{env_var("TEST1",   "default")  }}', 'default');
  });

  it('evalJinjaEnvVar should return object if as_native filter used', () => {
    // arrange
    const json = {
      key1: 'value1',
      key2: 'value2',
    };
    process.env['KEY_JSON'] = JSON.stringify(json);

    // act, assert
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{ env_var("KEY_JSON") | as_native }}', json);
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{  env_var("KEY_JSON")     |     as_native }}', json);
  });

  it('evalJinjaEnvVar should not return object there is no as_native filter', () => {
    // arrange
    const json = {
      key1: 'value1',
      key2: 'value2',
    };
    process.env['KEY_JSON'] = JSON.stringify(json);

    // act, assert
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{ env_var("KEY_JSON") }}', JSON.stringify(json));
  });

  it('evalJinjaEnvVar should return number if int or as_number filter used', () => {
    // arrange
    const value = 5;
    process.env['NUMBER_VALUE'] = String(value);

    // act, assert
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{ env_var("NUMBER_VALUE") | int }}', value);
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{  env_var("NUMBER_VALUE")     |     int }}', value);

    evalJinjaEnvVarShouldReturnEnvironmentValue('{{ env_var("NUMBER_VALUE") | as_number }}', value);
    evalJinjaEnvVarShouldReturnEnvironmentValue('{{  env_var("NUMBER_VALUE")     |     as_number }}', value);
  });
});

function evalJinjaEnvVarShouldReturnEnvironmentValue(text: string, expectedResult: string | object | number): void {
  // act
  const result = evalProfilesYmlJinjaEnvVar(text);

  // assert
  assertThat(result, expectedResult);
}
