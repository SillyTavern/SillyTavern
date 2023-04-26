class ModelData:
    def __init__(self, name, version = "", revision="", path="", download=""):
        self.name = name
        self.version = version
        self.revision = revision
        self.path = path
        self.download = download

    def __str__(self):
        return self.args().__str__()

    def args(self):
        args = ["-m", self.name]
        if (self.version):
            args += ["-g", self.version]
        if (self.revision):
            args += ["-r", self.revision]
        return args


class ModelFactory:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

    def NewModelData(self, name, **kwargs):
        cpy = self.kwargs.copy()
        cpy.update(kwargs)
        return ModelData(name = name, **cpy)


def GetModels(Version):
    mf = ModelFactory(version=Version)
    return {
        "Nerys V2 6B": mf.NewModelData("KoboldAI/OPT-6B-nerys-v2"),
        "Erebus 6B": mf.NewModelData("KoboldAI/OPT-6.7B-Erebus"),
        "Skein 6B": mf.NewModelData("KoboldAI/GPT-J-6B-Skein"),
        "Janeway 6B": mf.NewModelData("KoboldAI/GPT-J-6B-Janeway"),
        "Adventure 6B": mf.NewModelData("KoboldAI/GPT-J-6B-Adventure"),
        "Руgmаlіоn 6В": mf.NewModelData("PygmalionAI/pygmalion-6b"),
        "Руgmаlіоn 6В Dev": mf.NewModelData("PygmalionAI/pygmalion-6b", revision="dev"),
        "Lit V2 6B": mf.NewModelData("hakurei/litv2-6B-rev3"),
        "Lit 6B": mf.NewModelData("hakurei/lit-6B"),
        "Shinen 6B": mf.NewModelData("KoboldAI/GPT-J-6B-Shinen"),
        "Nerys 2.7B": mf.NewModelData("KoboldAI/fairseq-dense-2.7B-Nerys"),
        "Erebus 2.7B": mf.NewModelData("KoboldAI/OPT-2.7B-Erebus"),
        "Janeway 2.7B": mf.NewModelData("KoboldAI/GPT-Neo-2.7B-Janeway"),
        "Picard 2.7B": mf.NewModelData("KoboldAI/GPT-Neo-2.7B-Picard"),
        "AID 2.7B": mf.NewModelData("KoboldAI/GPT-Neo-2.7B-AID"),
        "Horni LN 2.7B": mf.NewModelData("KoboldAI/GPT-Neo-2.7B-Horni-LN"),
        "Horni 2.7B": mf.NewModelData("KoboldAI/GPT-Neo-2.7B-Horni"),
        "Shinen 2.7B": mf.NewModelData("KoboldAI/GPT-Neo-2.7B-Shinen"),
        "Fairseq Dense 2.7B": mf.NewModelData("KoboldAI/fairseq-dense-2.7B"),
        "OPT 2.7B": mf.NewModelData("facebook/opt-2.7b"),
        "Neo 2.7B": mf.NewModelData("EleutherAI/gpt-neo-2.7B"),
        "Руgwау 6B": mf.NewModelData("TehVenom/PPO_Pygway-6b"),
        "Nerybus 6.7B": mf.NewModelData("KoboldAI/OPT-6.7B-Nerybus-Mix"),
        "Руgwау v8p4": mf.NewModelData("TehVenom/PPO_Pygway-V8p4_Dev-6b"),
        "PPO-Janeway 6B": mf.NewModelData("TehVenom/PPO_Janeway-6b"),
        "PPO Shуgmаlіоn 6B": mf.NewModelData("TehVenom/PPO_Shygmalion-6b"),
        "LLaMA 7B": mf.NewModelData("decapoda-research/llama-7b-hf"),
        "Janin-GPTJ": mf.NewModelData("digitous/Janin-GPTJ"),
        "Javelin-GPTJ": mf.NewModelData("digitous/Javelin-GPTJ"),
        "Javelin-R": mf.NewModelData("digitous/Javelin-R"),
        "Janin-R": mf.NewModelData("digitous/Janin-R"),
        "Javalion-R": mf.NewModelData("digitous/Javalion-R"),
        "Javalion-GPTJ": mf.NewModelData("digitous/Javalion-GPTJ"),
        "Javelion-6B": mf.NewModelData("Cohee/Javelion-6b"),
        "GPT-J-Руg-PPO-6B": mf.NewModelData("TehVenom/GPT-J-Pyg_PPO-6B"),
        "ppo_hh_pythia-6B": mf.NewModelData("reciprocate/ppo_hh_pythia-6B"),
        "ppo_hh_gpt-j": mf.NewModelData("reciprocate/ppo_hh_gpt-j"),
        "Alpaca-7B": mf.NewModelData("chainyo/alpaca-lora-7b"),
        "LLaMA 4-bit": mf.NewModelData("decapoda-research/llama-13b-hf-int4"),
        "GPT-J-Руg_PPO-6B": mf.NewModelData("TehVenom/GPT-J-Pyg_PPO-6B"),
        "GPT-J-Руg_PPO-6B-Dev-V8p4": mf.NewModelData("TehVenom/GPT-J-Pyg_PPO-6B-Dev-V8p4"),
        "Dolly_GPT-J-6b": mf.NewModelData("TehVenom/Dolly_GPT-J-6b"),
        "Dolly_Руg-6B": mf.NewModelData("TehVenom/AvgMerge_Dolly-Pygmalion-6b")
    }