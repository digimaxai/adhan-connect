# Synthetic format fixture

`tone.m4a` is a two-second 440 Hz sine wave generated for these tests, not an
adhan or third-party recording. It was generated from mono 16-bit PCM at
22050 Hz, amplitude 1000, then encoded using macOS:

```
afconvert -f m4af -d aac tone.wav tone.m4a
```

WAV and MPEG frame fixtures are generated in the test script. They verify
format metadata validation, not mobile-device playback or audio quality.
