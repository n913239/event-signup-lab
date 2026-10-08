改完之後重跑 `./gradlew :app:assembleDebug`,還是失敗。錯誤訊息原文:

```
e: api/build/generated/openapi/src/main/kotlin/com/example/eventreg/api/models/Health200Response.kt:48:35 Argument type mismatch: actual type is 'kotlin.String', but 'kotlin.Boolean' was expected.
* What went wrong:
Execution failed for task ':api:compileKotlin'.
> A failure occurred while executing org.jetbrains.kotlin.compilerRunner.GradleCompilerRunnerWithWorkers$GradleKotlinCompilerWorkAction
   > Compilation error. See log for more details
```

請直接改檔修好。
