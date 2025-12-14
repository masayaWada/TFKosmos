pub struct NamingGenerator;

impl NamingGenerator {
    pub fn to_snake_case(s: &str) -> String {
        s.replace('-', "_").replace('.', "_").to_lowercase()
    }

    pub fn to_kebab_case(s: &str) -> String {
        s.replace('_', "-").replace('.', "-").to_lowercase()
    }

    pub fn apply_naming_convention(s: &str, convention: &str) -> String {
        match convention {
            "snake_case" => Self::to_snake_case(s),
            "kebab-case" => Self::to_kebab_case(s),
            "original" => s.to_string(),
            _ => s.to_string(),
        }
    }
}
