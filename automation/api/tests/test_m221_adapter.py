import base64

import pytest

from api.ir.m221_adapter import logic_to_il, plc_program_to_m221_data
from api.ir.patterns import build_pattern
from api.services.m221_smbp_builder import M221SmbpBuilder
from plc_file_handler.parsers.schneider_parser import SchneiderParser


@pytest.fixture
def motor_program():
    return build_pattern(
        "motor_startstop",
        project_name="AdapterMotor",
        vendor="schneider",
        model="TM221CE16T",
    )


class TestM221Adapter:
    def test_motor_pattern_maps_io_and_rungs(self, motor_program):
        data = plc_program_to_m221_data(motor_program)
        assert data["projectName"] == "AdapterMotor"
        assert len(data["inputs"]) == 2
        assert len(data["outputs"]) == 2
        assert len(data["rungs"]) == 2
        assert data["rungs"][0]["il"][0].startswith("LD ")

    def test_motor_il_seal_in_rung(self, motor_program):
        var_by_symbol = {var.symbol: var for var in motor_program.vars}
        network = motor_program.pous[0].networks[0]
        il = logic_to_il(network.logic, var_by_symbol)
        assert il == ["LD %I0.0", "OR %Q0.0", "ANDN %I0.1", "ST %Q0.0"]

    def test_adapter_builds_parseable_smbp(self, motor_program, tmp_path):
        data = plc_program_to_m221_data(motor_program)
        result = M221SmbpBuilder().build(data, "TM221CE16T", motor_program.name)
        path = tmp_path / result["fileName"]
        path.write_bytes(base64.standard_b64decode(result["contentBase64"]))
        project = SchneiderParser(str(path)).parse()
        assert project["platform"] == "schneider_m221"
        assert len(project["tags"]) >= 2
