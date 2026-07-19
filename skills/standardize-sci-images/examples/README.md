# Reproducible example

Create deterministic synthetic fluorescence-like inputs and a valid manifest:

```bash
python ../scripts/make_example_data.py --outdir synthetic_inputs
python ../scripts/standardize_images.py synthetic_inputs/manifest.csv \
  --outdir synthetic_outputs --scale-bar-um 20
```

These images are synthetic software-test data, not biological observations.
