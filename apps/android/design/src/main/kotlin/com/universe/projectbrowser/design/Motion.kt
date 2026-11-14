package com.universe.projectbrowser.design

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Immutable
import kotlin.math.PI
import kotlin.math.pow
import kotlin.math.sqrt

object SwiftEasing {
    val easeOut: Easing = CubicBezierEasing(0f, 0f, 0.58f, 1f)
    val easeIn: Easing = CubicBezierEasing(0.42f, 0f, 1f, 1f)
    val easeInOut: Easing = CubicBezierEasing(0.42f, 0f, 0.58f, 1f)
    val linear: Easing = LinearEasing
    val logoSpin: Easing = CubicBezierEasing(0.12f, 0.7f, 0.25f, 1f)
}

@Immutable
sealed interface UniVerseMotion {
    fun <T> spec(visibilityThreshold: T? = null): FiniteAnimationSpec<T>
}

@Immutable
data class UniVerseSpring(val response: Float, val dampingFraction: Float) : UniVerseMotion {
    val stiffness: Float get() = (2.0 * PI / response).pow(2).toFloat()

    val dampingRatio: Float get() = dampingFraction

    val damping: Float get() = (2.0 * dampingFraction * sqrt(stiffness.toDouble())).toFloat()

    override fun <T> spec(visibilityThreshold: T?): FiniteAnimationSpec<T> =
        spring(dampingRatio = dampingRatio, stiffness = stiffness, visibilityThreshold = visibilityThreshold)

    companion object {
        fun withBounce(duration: Float, bounce: Float): UniVerseSpring =
            UniVerseSpring(response = duration, dampingFraction = if (bounce >= 0f) 1f - bounce else 1f / (1f + bounce))
    }
}

@Immutable
data class UniVerseTween(val durationMillis: Int, val easing: Easing, val delayMillis: Int = 0) : UniVerseMotion {
    override fun <T> spec(visibilityThreshold: T?): FiniteAnimationSpec<T> =
        tween(durationMillis = durationMillis, delayMillis = delayMillis, easing = easing)
}

object Motion {
    val snappy = UniVerseSpring(response = 0.3f, dampingFraction = 0.86f)
    val smooth = UniVerseSpring(response = 0.42f, dampingFraction = 0.9f)
    val tabStack = UniVerseSpring.withBounce(duration = 0.4f, bounce = 0.2f)
    val modeToggle = UniVerseSpring.withBounce(duration = 0.3f, bounce = 0.15f)

    val searchRise = UniVerseSpring(response = 0.39f, dampingFraction = 1f)
    val surfaceSwap = UniVerseTween(300, SwiftEasing.easeOut)
    val surfaceFade = UniVerseTween(200, SwiftEasing.easeOut)
    val trayDim = UniVerseTween(300, SwiftEasing.easeInOut)
    val trayDismiss = UniVerseSpring(response = 0.32f, dampingFraction = 1f)
    val traySettle = UniVerseSpring(response = 0.34f, dampingFraction = 0.86f)
    val resultsIn = UniVerseTween(140, SwiftEasing.easeOut)
    val pager = UniVerseSpring(response = 0.3f, dampingFraction = 0.9f)
    val press = UniVerseSpring(response = 0.2f, dampingFraction = 0.7f)
    val barPressIn = UniVerseSpring.withBounce(duration = 0.08f, bounce = 0f)
    val barPressOut = UniVerseSpring.withBounce(duration = 0.16f, bounce = 0.1f)
    val barCollapse = UniVerseSpring.withBounce(duration = 0.4f, bounce = 0f)
    val progressReveal = UniVerseTween(200, SwiftEasing.easeOut)
    val progressAdvance = UniVerseTween(450, SwiftEasing.easeOut)
    val progressFill = UniVerseTween(200, SwiftEasing.easeOut)
    val progressFade = UniVerseTween(250, SwiftEasing.easeOut)
    const val progressRevealDelayMillis = 150L
    const val placeholderDelayMillis = 300L
    val placeholderIn = UniVerseTween(220, SwiftEasing.easeOut)
    val pagerSettle = UniVerseSpring.withBounce(duration = 0.38f, bounce = 0f)
    val pagerFade = UniVerseTween(200, SwiftEasing.easeOut)
    val barTone = UniVerseTween(250, SwiftEasing.easeOut)
    val logoSpin = UniVerseTween(2200, SwiftEasing.logoSpin)
    val reducedFade = UniVerseTween(200, SwiftEasing.easeInOut)
    val reducedSettle = UniVerseTween(200, SwiftEasing.easeOut)
    val logoReset = UniVerseTween(300, SwiftEasing.easeOut)
}
