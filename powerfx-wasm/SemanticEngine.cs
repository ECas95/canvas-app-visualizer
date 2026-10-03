using System.Globalization;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text.Json;
using Microsoft.PowerFx;

namespace CanvasAppVisualizer.PowerFxWasm;

[SupportedOSPlatform("browser")]
public static partial class SemanticEngine
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    [JSExport]
    public static string Parse(string formula, string locale, bool allowsSideEffects)
    {
        try
        {
            var engine = CreateEngine();
            var options = CreateParserOptions(locale, allowsSideEffects);
            var result = engine.Parse(formula, options);

            return JsonSerializer.Serialize(new
            {
                engine = "Microsoft.PowerFx",
                mode = "parse",
                success = result.IsSuccess,
                errors = result.Errors.Select(ToDiagnostic).ToArray()
            }, JsonOptions);
        }
        catch (Exception ex)
        {
            return SerializeHostFailure("parse", ex);
        }
    }

    [JSExport]
    public static string Check(string formula, string locale, bool allowsSideEffects)
    {
        try
        {
            var engine = CreateEngine();
            var options = CreateParserOptions(locale, allowsSideEffects);
            var result = engine.Check(formula, parameterType: null, options);

            return JsonSerializer.Serialize(new
            {
                engine = "Microsoft.PowerFx",
                mode = "check",
                success = result.IsSuccess,
                returnType = result.IsSuccess ? result.ReturnType?.ToString() : null,
                errors = result.Errors.Select(ToDiagnostic).ToArray()
            }, JsonOptions);
        }
        catch (Exception ex)
        {
            return SerializeHostFailure("check", ex);
        }
    }

    private static Engine CreateEngine()
    {
        var config = new PowerFxConfig(Features.PowerFxV1);
        return new Engine(config);
    }

    private static ParserOptions CreateParserOptions(
        string locale,
        bool allowsSideEffects)
    {
        CultureInfo culture;
        try
        {
            culture = string.IsNullOrWhiteSpace(locale)
                ? CultureInfo.GetCultureInfo("en-US")
                : CultureInfo.GetCultureInfo(locale);
        }
        catch (CultureNotFoundException)
        {
            culture = CultureInfo.GetCultureInfo("en-US");
        }

        return new ParserOptions
        {
            Culture = culture,
            AllowsSideEffects = allowsSideEffects,
            NumberIsFloat = true
        };
    }

    private static object ToDiagnostic(ExpressionError error)
    {
        return new
        {
            message = error.Message,
            severity = error.Severity.ToString(),
            warning = error.IsWarning,
            start = error.Span?.Min,
            end = error.Span?.Lim
        };
    }

    private static string SerializeHostFailure(string mode, Exception exception)
    {
        return JsonSerializer.Serialize(new
        {
            engine = "Microsoft.PowerFx",
            mode,
            success = false,
            hostError = exception.Message
        }, JsonOptions);
    }
}
