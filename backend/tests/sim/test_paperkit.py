from pathlib import Path

from sim.content import ContentBundle
from sim.paperkit import write_paper_kit


def test_paper_kit_and_answer_keys(content: ContentBundle, tmp_path: Path) -> None:
    written = write_paper_kit(content, tmp_path / "kit", tmp_path / "keys")
    files = {f.name: f.read_text() for f in written if f.parent.name == "kit"}
    keys = {f.stem: f.read_text() for f in written if f.parent.name == "keys"}
    assert {"00-facilitator-pack.md", "01-investment-cards.md", "02-crisis-packets.md"} <= set(files)
    for pid, payer in content.payers.items():
        pack = files[f"team-{pid}.md"]
        assert payer.name in pack and "Decision form" in pack
        for rc in payer.hidden_root_causes:
            assert rc.title not in pack  # answer key never in team packs
            assert rc.title in keys[pid]
    for ev in content.events.values():
        assert ev.packet[:60] in files["02-crisis-packets.md"]
    assert all(inv.name in files["01-investment-cards.md"] for inv in content.investments.values())
    assert "Contingency cuts" in files["00-facilitator-pack.md"]
    primer = files["03-stars-primer.md"]  # OD-12 optional pre-read, driven by the game config
    assert f"${content.config.bonus_pmpy_usd:,.0f}" in primer
    assert all(m.name in primer for m in content.measures.values())
    for hidden in (rc.title for p in content.payers.values() for rc in p.hidden_root_causes):
        assert hidden not in primer
