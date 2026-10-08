import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.openapitools.generator.gradle.plugin.tasks.GenerateTask

// 這個模組沒有手寫程式碼:API client 與 model 全部由 openapi.yaml 產生。
// 產生的是純 JVM 程式(OkHttp + Moshi),所以獨立成 kotlin-jvm 模組,讓 :app 依賴。

plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.openapi.generator")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

val generateApi = tasks.named<GenerateTask>("openApiGenerate") {
    generatorName.set("kotlin")
    library.set("jvm-okhttp4")
    inputSpec.set(rootProject.file("openapi.yaml").absolutePath)
    outputDir.set(layout.buildDirectory.dir("generated/openapi").map { it.asFile.absolutePath })

    packageName.set("com.example.eventreg.api")
    apiPackage.set("com.example.eventreg.api.apis")
    modelPackage.set("com.example.eventreg.api.models")

    configOptions.set(
        mapOf(
            "serializationLibrary" to "moshi",
            "dateLibrary" to "java8",
            "enumPropertyNaming" to "UPPERCASE",
            "sourceFolder" to "src/main/kotlin",
            "omitGradleWrapper" to "true",
        )
    )

    // 契約是 OpenAPI 3.1:`type: [string, 'null']`、`oneOf: [Hold, {type: 'null'}]`。
    // 先正規化成 3.0 風格的 nullable,否則「required 但可為 null」的欄位(例如 Order.promo_code)
    // 會被產成非 null 型別,Moshi 遇到 null 直接丟例外。
    openapiNormalizer.set(
        mapOf(
            "NORMALIZE_31SPEC" to "true",
            "SIMPLIFY_ONEOF_ANYOF" to "true",
        )
    )
    // swagger-parser 對 3.1 的驗證仍有誤報(type 陣列、const),契約正確性交給後端那邊的檢查。
    skipValidateSpec.set(true)

    generateApiTests.set(false)
    generateModelTests.set(false)
    generateApiDocumentation.set(false)
    generateModelDocumentation.set(false)
}

kotlin.sourceSets.named("main") {
    kotlin.srcDir(generateApi.map { File(it.outputDir.get(), "src/main/kotlin") })
}

tasks.named("compileKotlin") { dependsOn(generateApi) }

dependencies {
    api("com.squareup.okhttp3:okhttp:4.12.0")
    api("com.squareup.moshi:moshi:1.15.1")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")
    implementation("com.squareup.moshi:moshi-adapters:1.15.1")
    // moshi-kotlin 會帶進舊版 kotlin-reflect,讀不懂 Kotlin 2.0 編出來的 metadata;對齊版本。
    implementation("org.jetbrains.kotlin:kotlin-reflect:2.0.21")
}
