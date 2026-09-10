"""AquaYantra — Simulator tests."""

import pytest
from simulator import Scenario, SimulationEngine, SimulatorConfig


class TestSimulator:
    def test_normal_survey_generates_packets(self):
        config = SimulatorConfig(
            scenario=Scenario.NORMAL_SURVEY,
            duration_seconds=10.0,
            sample_rate_hz=2.0,
        )
        engine = SimulationEngine(config)
        packets = list(engine.generate())
        assert len(packets) == 20

    def test_strong_anomaly_creates_deviation(self):
        config = SimulatorConfig(
            scenario=Scenario.STRONG_ANOMALY,
            duration_seconds=60.0,
            sample_rate_hz=2.0,
        )
        engine = SimulationEngine(config)
        packets = list(engine.generate())

        # At least some packets should have elevated Z values
        z_values = [p.mag_z for p in packets if p.mag_z is not None]
        max_z = max(z_values)
        assert max_z > 50.0, "Strong anomaly should produce elevated Z values"

    def test_packet_loss_scenario(self):
        config = SimulatorConfig(
            scenario=Scenario.PACKET_LOSS,
            duration_seconds=30.0,
            sample_rate_hz=2.0,
        )
        engine = SimulationEngine(config)
        packets = list(engine.generate())
        expected_total = 60
        assert len(packets) < expected_total, "Packet loss should reduce count"

    def test_sensor_failure_produces_null_mag(self):
        config = SimulatorConfig(
            scenario=Scenario.SENSOR_FAILURE,
            duration_seconds=30.0,
            sample_rate_hz=2.0,
        )
        engine = SimulationEngine(config)
        packets = list(engine.generate())

        # After 70% of duration, magnetometer should be null
        late_packets = packets[int(len(packets) * 0.75):]
        null_count = sum(1 for p in late_packets if p.mag_x is None)
        assert null_count > 0, "Sensor failure should produce null magnetometer data"

    def test_all_scenarios_produce_valid_packets(self):
        for scenario in Scenario:
            config = SimulatorConfig(
                scenario=scenario,
                duration_seconds=5.0,
                sample_rate_hz=2.0,
            )
            engine = SimulationEngine(config)
            packets = list(engine.generate())
            assert len(packets) > 0, f"Scenario {scenario} produced no packets"
            for p in packets:
                assert p.device_id is not None
                assert p.timestamp is not None
