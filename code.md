```php
$ui = $doc['ui_validation'] ?? $doc['ui_config'] ?? null;

if (is_array($ui)) {
    $declared = (int)($ui['declared'] ?? 0);
    $accepted = (int)($ui['accepted'] ?? 0);

    if ($declared > 0 && $accepted <= 0) {
        return ActivationResult::fail(['reason' => 'ui_not_accepted']);
    }
}

```